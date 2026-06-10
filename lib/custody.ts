'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID } from '@/lib/feature-settings'
import { resolveZoneForPoint, getZoneDriver } from '@/lib/zones'

// ============================================================================
// Chain of custody (append-only ledger) + delivery leg-status derivation.
// The `custody_events` table is immutable (DB trigger blocks UPDATE/DELETE);
// the delivery's `current_holder` / `leg_status` are a projection of it.
// ============================================================================

export type CustodyEventType =
  | 'pickup'
  | 'hub_in'
  | 'hub_out'
  | 'handoff'
  | 'transfer_out'
  | 'transfer_in'
  | 'delivered'
  | 'exception'

export type ActorType = 'driver' | 'admin' | 'system'
export type ScanMethod = 'qr' | 'manual' | 'auto'

// Leg state machine (spec §5).
export type LegStatus =
  | 'created'
  | 'picked_up'
  | 'at_hub'
  | 'out_for_delivery'
  | 'delivered'
  | 'exception'

// Holder is a "kind:id" string: driver:<uuid> | hub | business:<uuid> | recipient
export type HolderKind = 'driver' | 'hub' | 'business' | 'recipient'

export interface CustodyEvent {
  id: string
  deliveryId: string
  eventType: CustodyEventType
  actorType: ActorType
  actorId: string | null
  fromHolder: string | null
  toHolder: string | null
  scanMethod: ScanMethod | null
  lat: number | null
  lng: number | null
  notes: string | null
  metadata: Record<string, unknown>
  clientEventId: string | null
  createdAt: string
}

type CustodyRow = {
  id: string
  delivery_id: string
  event_type: CustodyEventType
  actor_type: ActorType
  actor_id: string | null
  from_holder: string | null
  to_holder: string | null
  scan_method: ScanMethod | null
  lat: number | null
  lng: number | null
  notes: string | null
  metadata: Record<string, unknown> | null
  client_event_id: string | null
  created_at: string
}

function mapEvent(r: CustodyRow): CustodyEvent {
  return {
    id: r.id,
    deliveryId: r.delivery_id,
    eventType: r.event_type,
    actorType: r.actor_type,
    actorId: r.actor_id,
    fromHolder: r.from_holder,
    toHolder: r.to_holder,
    scanMethod: r.scan_method,
    lat: r.lat,
    lng: r.lng,
    notes: r.notes,
    metadata: r.metadata ?? {},
    clientEventId: r.client_event_id,
    createdAt: r.created_at,
  }
}

/** Map an event type to the resulting leg_status (single source of truth). */
function legStatusForEvent(type: CustodyEventType): LegStatus | null {
  switch (type) {
    case 'pickup':
      return 'picked_up'
    case 'hub_in':
      return 'at_hub'
    case 'hub_out':
    case 'handoff':
    case 'transfer_in':
      return 'out_for_delivery'
    case 'delivered':
      return 'delivered'
    case 'exception':
      return 'exception'
    // transfer_out is a release; the receiving transfer_in advances status.
    default:
      return null
  }
}

export async function getCustodyTimeline(deliveryId: string): Promise<CustodyEvent[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('custody_events')
    .select(
      'id, delivery_id, event_type, actor_type, actor_id, from_holder, to_holder, scan_method, lat, lng, notes, metadata, client_event_id, created_at',
    )
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data as CustodyRow[]).map(mapEvent)
}

export interface RecordCustodyInput {
  deliveryId: string
  eventType: CustodyEventType
  actorType: ActorType
  actorId?: string | null
  toHolder?: string | null
  scanMethod?: ScanMethod
  lat?: number | null
  lng?: number | null
  notes?: string | null
  metadata?: Record<string, unknown>
  /** Idempotency key for offline scan queues (Phase 2). */
  clientEventId?: string | null
}

/**
 * Append a custody event, then project the delivery's holder + leg_status.
 * Idempotent on clientEventId: a duplicate insert is swallowed (unique index)
 * and the existing event is returned instead.
 */
export async function recordCustodyEvent(
  input: RecordCustodyInput,
): Promise<CustodyEvent> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')

  // Current holder becomes the new event's from_holder.
  const { data: deliveryRow } = await supabase
    .from('deliveries')
    .select('current_holder')
    .eq('id', input.deliveryId)
    .maybeSingle()
  const fromHolder = (deliveryRow as { current_holder: string | null } | null)?.current_holder ?? null

  const { data, error } = await supabase
    .from('custody_events')
    .insert({
      org_id: ORG_ID,
      delivery_id: input.deliveryId,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      from_holder: fromHolder,
      to_holder: input.toHolder ?? null,
      scan_method: input.scanMethod ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      client_event_id: input.clientEventId ?? null,
    })
    .select(
      'id, delivery_id, event_type, actor_type, actor_id, from_holder, to_holder, scan_method, lat, lng, notes, metadata, client_event_id, created_at',
    )
    .single()

  if (error) {
    // Idempotent replay: unique violation on client_event_id -> return existing.
    if (error.code === '23505' && input.clientEventId) {
      const { data: existing } = await supabase
        .from('custody_events')
        .select(
          'id, delivery_id, event_type, actor_type, actor_id, from_holder, to_holder, scan_method, lat, lng, notes, metadata, client_event_id, created_at',
        )
        .eq('client_event_id', input.clientEventId)
        .single()
      if (existing) return mapEvent(existing as CustodyRow)
    }
    throw error
  }

  // Project holder + leg_status onto the delivery.
  const patch: Record<string, unknown> = {}
  if (input.toHolder !== undefined && input.toHolder !== null) {
    patch.current_holder = input.toHolder
    if (input.toHolder.startsWith('driver:')) {
      patch.holder_driver_id = input.toHolder.slice('driver:'.length)
    } else {
      patch.holder_driver_id = null
    }
  }
  const nextLeg = legStatusForEvent(input.eventType)
  if (nextLeg) patch.leg_status = nextLeg

  if (Object.keys(patch).length > 0) {
    await supabase.from('deliveries').update(patch).eq('id', input.deliveryId)
  }

  return mapEvent(data as CustodyRow)
}

// ============================================================================
// Scan token generation (Phase 2 uses it; created at delivery creation).
// ============================================================================

const TOKEN_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no ambiguous chars

function randomToken(): string {
  let s = ''
  for (let i = 0; i < 5; i++) {
    s += TOKEN_ALPHABET[Math.floor(Math.random() * TOKEN_ALPHABET.length)]
  }
  return `LV-${s}`
}

/** Generate a collision-checked scan token (retries on the unique index). */
export async function generateScanToken(): Promise<string> {
  const supabase = createClient()
  if (!supabase) return randomToken()
  for (let attempt = 0; attempt < 6; attempt++) {
    const token = randomToken()
    const { data } = await supabase
      .from('deliveries')
      .select('id')
      .eq('scan_token', token)
      .maybeSingle()
    if (!data) return token
  }
  // Extremely unlikely; fall back to a longer token.
  return `${randomToken()}${randomToken().slice(3)}`
}

// ============================================================================
// Delivery assignment orchestration (flag-gated; called at create time).
// ============================================================================

export interface AssignZonesResult {
  pickupZoneId: string | null
  dropoffZoneId: string | null
  pickupDriverId: string | null
  deliveryDriverId: string | null
  routingMode: 'direct' | 'cross_dock'
  scanToken: string
}

/**
 * Resolve pickup/dropoff zones for a delivery, look up today's zone drivers,
 * decide direct vs cross-dock routing, mint a scan token, and persist it all.
 * Safe to call only when zones_enabled; callers gate on the feature flag.
 */
export async function assignZonesForDelivery(input: {
  deliveryId: string
  pickupLat?: number | null
  pickupLng?: number | null
  pickupPostal?: string | null
  dropoffLat?: number | null
  dropoffLng?: number | null
  dropoffPostal?: string | null
  autoAssignDriver: boolean
}): Promise<AssignZonesResult> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')

  const [pickupZoneId, dropoffZoneId] = await Promise.all([
    resolveZoneForPoint(input.pickupLat, input.pickupLng, input.pickupPostal),
    resolveZoneForPoint(input.dropoffLat, input.dropoffLng, input.dropoffPostal),
  ])

  let pickupDriverId: string | null = null
  let deliveryDriverId: string | null = null
  if (input.autoAssignDriver) {
    ;[pickupDriverId, deliveryDriverId] = await Promise.all([
      pickupZoneId ? getZoneDriver(pickupZoneId) : Promise.resolve(null),
      dropoffZoneId ? getZoneDriver(dropoffZoneId) : Promise.resolve(null),
    ])
  }

  // Same driver owns both ends -> direct (no hub consolidation needed).
  const sameDriver =
    pickupDriverId !== null && pickupDriverId === deliveryDriverId
  const sameZone = pickupZoneId !== null && pickupZoneId === dropoffZoneId
  const routingMode: 'direct' | 'cross_dock' =
    sameDriver || sameZone ? 'direct' : 'cross_dock'

  const scanToken = await generateScanToken()

  // For a direct job we can hand the pickup driver the whole leg; for
  // cross-dock the pickup driver carries it to the hub.
  const patch: Record<string, unknown> = {
    pickup_zone_id: pickupZoneId,
    dropoff_zone_id: dropoffZoneId,
    routing_mode: routingMode,
    scan_token: scanToken,
    leg_status: 'created',
  }
  if (input.autoAssignDriver && pickupDriverId) {
    patch.driver_id = pickupDriverId
    patch.holder_driver_id = pickupDriverId
    patch.current_holder = `driver:${pickupDriverId}`
  }

  const { error } = await supabase
    .from('deliveries')
    .update(patch)
    .eq('id', input.deliveryId)
  if (error) throw error

  return {
    pickupZoneId,
    dropoffZoneId,
    pickupDriverId,
    deliveryDriverId,
    routingMode,
    scanToken,
  }
}
