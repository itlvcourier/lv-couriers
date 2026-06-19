'use client'

import { createClient } from '@/lib/supabase/client'
import { mapDeliveryRow } from '@/lib/db-extended'
import type { Delivery } from '@/lib/types'
import {
  recordCustodyEvent,
  type CustodyEventType,
  type ScanMethod,
} from '@/lib/custody'

// ============================================================================
// Phase 2 — Labeling + scanning core.
//
// Responsibilities:
//  - Resolve a scanned `scan_token` (the QR payload) back to a Delivery.
//  - Map a scan to the right custody event based on WHERE it happens
//    (pickup run / hub sort / delivery) — "context-aware scanning".
//  - Queue scans offline with a stable client_event_id and replay them in
//    order on reconnect. recordCustodyEvent() is idempotent on that id, so
//    replay can never double-count.
// ============================================================================

/** The screen/context a scan happens in — decides what the scan means. */
export type ScanContext = 'pickup' | 'hub_sort' | 'hub_accept' | 'delivery'

/** Result of attempting to resolve + apply a scan. */
export type ScanOutcome =
  | { kind: 'ok'; delivery: Delivery; eventType: CustodyEventType; queued: boolean }
  | { kind: 'unknown_token' }
  | { kind: 'wrong_stage'; delivery: Delivery; message: string }
  | { kind: 'already_done'; delivery: Delivery; message: string }
  | { kind: 'error'; message: string }

const SCAN_TOKEN_RE = /^LV-[A-Z0-9]{5,}$/i

/** Normalize raw decoded text into a scan token, or null if it isn't ours. */
export function parseScanPayload(raw: string): string | null {
  if (!raw) return null
  let text = raw.trim()
  // Allow URLs that embed the token, e.g. https://app/scan/LV-7K3P9
  const urlMatch = text.match(/LV-[A-Z0-9]{5,}/i)
  if (urlMatch) text = urlMatch[0]
  text = text.toUpperCase()
  return SCAN_TOKEN_RE.test(text) ? text : null
}

const DELIVERY_COLUMNS =
  'id, business_id, location_id, driver_id, status, pickup_address, pickup_area, pickup_postal_code, pickup_lat, pickup_lng, dropoff_address, dropoff_area, dropoff_postal_code, dropoff_lat, dropoff_lng, recipient_name, recipient_phone, buzz_code, is_urgent, is_out_of_town, is_rush, retry_count, posted_at, claimed_at, pickup_arrived_at, picked_up_at, delivered_at, rate_card_id, calculated_rate, gst_amount, total_amount, invoice_id, duration_mins, pickup_photo_url, proof_photo_url, signature_url, recipient_note, require_signature, require_photo, tracking_code, tracking_expires_at, cancelled_at, cancellation_stage, cancellation_fee, cancellation_reason, distance_km, trip_id, trip_order, assigned_at, assigned_by, pickup_zone_id, dropoff_zone_id, current_holder, holder_driver_id, leg_status, routing_mode, scan_token, pickup_pay, delivery_pay, created_at, updated_at, business:businesses(name), driver:drivers!deliveries_driver_id_fkey(name)'

/** Resolve a scan token to a full Delivery (or null if not found). */
export async function findDeliveryByScanToken(
  token: string,
): Promise<Delivery | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('deliveries')
    .select(DELIVERY_COLUMNS)
    .eq('scan_token', token)
    .maybeSingle()
  if (error || !data) return null
  return mapDeliveryRow(data as Record<string, unknown>)
}

/**
 * Decide the custody event a scan should produce given the screen context and
 * the delivery's current leg_status. Returns either an event type to record,
 * or a guidance outcome (wrong stage / already done).
 */
export function resolveScanEvent(
  context: ScanContext,
  delivery: Delivery,
):
  | { ok: true; eventType: CustodyEventType }
  | { ok: false; outcome: ScanOutcome } {
  const leg = delivery.legStatus ?? 'created'

  switch (context) {
    case 'pickup': {
      if (leg === 'picked_up' || leg === 'at_hub' || leg === 'out_for_delivery') {
        return { ok: false, outcome: { kind: 'already_done', delivery, message: 'Already picked up.' } }
      }
      if (leg === 'delivered') {
        return { ok: false, outcome: { kind: 'already_done', delivery, message: 'This parcel was already delivered.' } }
      }
      return { ok: true, eventType: 'pickup' }
    }
    case 'hub_sort': {
      if (leg === 'created') {
        return { ok: false, outcome: { kind: 'wrong_stage', delivery, message: 'Not picked up yet — scan it on the pickup run first.' } }
      }
      if (leg === 'at_hub' || leg === 'out_for_delivery') {
        return { ok: false, outcome: { kind: 'already_done', delivery, message: 'Already sorted at the hub.' } }
      }
      if (leg === 'delivered') {
        return { ok: false, outcome: { kind: 'already_done', delivery, message: 'This parcel was already delivered.' } }
      }
      return { ok: true, eventType: 'hub_in' }
    }
    case 'hub_accept': {
      if (leg !== 'at_hub') {
        return { ok: false, outcome: { kind: 'wrong_stage', delivery, message: 'This parcel is not waiting at the hub for you.' } }
      }
      return { ok: true, eventType: 'handoff' }
    }
    case 'delivery': {
      if (leg === 'delivered') {
        return { ok: false, outcome: { kind: 'already_done', delivery, message: 'Already delivered.' } }
      }
      if (leg === 'created') {
        return { ok: false, outcome: { kind: 'wrong_stage', delivery, message: 'Not picked up yet.' } }
      }
      return { ok: true, eventType: 'delivered' }
    }
    default:
      return { ok: false, outcome: { kind: 'error', message: 'Unknown scan context.' } }
  }
}

// ----------------------------------------------------------------------------
// Offline scan queue (localStorage). Each entry carries a stable client_event_id
// so replays are idempotent against custody_events' unique index.
// ----------------------------------------------------------------------------

export interface QueuedScan {
  clientEventId: string
  deliveryId: string
  scanToken: string
  eventType: CustodyEventType
  context: ScanContext
  actorType: 'driver' | 'admin'
  actorId: string | null
  toHolder: string | null
  scanMethod: ScanMethod
  lat: number | null
  lng: number | null
  notes: string | null
  metadata: Record<string, unknown>
  queuedAt: string
}

const QUEUE_KEY = 'doms.scanQueue.v1'

function readQueue(): QueuedScan[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY)
    return raw ? (JSON.parse(raw) as QueuedScan[]) : []
  } catch {
    return []
  }
}

function writeQueue(items: QueuedScan[]): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent('doms:scanqueue', { detail: items.length }))
  } catch {
    /* storage full / unavailable — best effort */
  }
}

export function getQueuedScans(): QueuedScan[] {
  return readQueue()
}

export function getQueuedScanCount(): number {
  return readQueue().length
}

function enqueueScan(scan: QueuedScan): void {
  const q = readQueue()
  q.push(scan)
  writeQueue(q)
}

function removeFromQueue(clientEventId: string): void {
  writeQueue(readQueue().filter((s) => s.clientEventId !== clientEventId))
}

/** Crypto-strong UUID with a fallback for older browsers. */
export function newClientEventId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return 'cid-' + Math.random().toString(36).slice(2) + Date.now().toString(36)
}

/**
 * Single-occurrence lifecycle events happen at most once per delivery. We give
 * them a DETERMINISTIC client_event_id so a double-tap, a re-scan, or an
 * offline-queue replay collapses to the same row (recordCustodyEvent swallows
 * the unique-index violation). Repeatable events (transfers, exceptions) keep a
 * random id so legitimate repeats are preserved.
 */
const SINGLE_OCCURRENCE: Partial<Record<CustodyEventType, true>> = {
  pickup: true,
  hub_in: true,
  handoff: true,
  delivered: true,
}

export function scanEventId(deliveryId: string, eventType: CustodyEventType): string {
  return SINGLE_OCCURRENCE[eventType]
    ? `evt:${deliveryId}:${eventType}`
    : newClientEventId()
}

export interface ApplyScanInput {
  context: ScanContext
  scanToken: string
  actorType: 'driver' | 'admin'
  actorId: string | null
  /** Holder the parcel moves to (e.g. `driver:<id>`, `hub`, `recipient`). */
  toHolder?: string | null
  lat?: number | null
  lng?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  scanMethod?: ScanMethod
}

/**
 * Resolve + apply a scan. Writes a custody event when online; on network
 * failure, queues it for later replay. Idempotent via client_event_id.
 */
export async function applyScan(input: ApplyScanInput): Promise<ScanOutcome> {
  const delivery = await findDeliveryByScanToken(input.scanToken).catch(() => null)
  if (!delivery) return { kind: 'unknown_token' }

  const resolved = resolveScanEvent(input.context, delivery)
  if (!resolved.ok) return resolved.outcome

  const clientEventId = scanEventId(delivery.id, resolved.eventType)
  const queued: QueuedScan = {
    clientEventId,
    deliveryId: delivery.id,
    scanToken: input.scanToken,
    eventType: resolved.eventType,
    context: input.context,
    actorType: input.actorType,
    actorId: input.actorId,
    toHolder: input.toHolder ?? null,
    scanMethod: input.scanMethod ?? 'qr',
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    notes: input.notes ?? null,
    metadata: input.metadata ?? {},
    queuedAt: new Date().toISOString(),
  }

  // Offline: queue and report success optimistically.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    enqueueScan(queued)
    return { kind: 'ok', delivery, eventType: resolved.eventType, queued: true }
  }

  try {
    await recordCustodyEvent({
      deliveryId: queued.deliveryId,
      eventType: queued.eventType,
      actorType: queued.actorType,
      actorId: queued.actorId,
      toHolder: queued.toHolder,
      scanMethod: queued.scanMethod,
      lat: queued.lat,
      lng: queued.lng,
      notes: queued.notes,
      metadata: queued.metadata,
      clientEventId: queued.clientEventId,
    })
    return { kind: 'ok', delivery, eventType: resolved.eventType, queued: false }
  } catch {
    // Network/transient failure — queue for replay.
    enqueueScan(queued)
    return { kind: 'ok', delivery, eventType: resolved.eventType, queued: true }
  }
}

export interface FlushResult {
  flushed: number
  remaining: number
}

let flushing = false

/** Replay queued scans in order. Safe to call repeatedly. */
export async function flushScanQueue(): Promise<FlushResult> {
  if (flushing) return { flushed: 0, remaining: getQueuedScanCount() }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { flushed: 0, remaining: getQueuedScanCount() }
  }
  flushing = true
  let flushed = 0
  try {
    // Process oldest first; stop on the first hard network failure so order
    // is preserved on the next attempt.
    for (const scan of readQueue()) {
      try {
        await recordCustodyEvent({
          deliveryId: scan.deliveryId,
          eventType: scan.eventType,
          actorType: scan.actorType,
          actorId: scan.actorId,
          toHolder: scan.toHolder,
          scanMethod: scan.scanMethod,
          lat: scan.lat,
          lng: scan.lng,
          notes: scan.notes,
          metadata: scan.metadata,
          clientEventId: scan.clientEventId,
        })
        removeFromQueue(scan.clientEventId)
        flushed += 1
      } catch {
        break
      }
    }
  } finally {
    flushing = false
  }
  return { flushed, remaining: getQueuedScanCount() }
}
