'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID, getFeatureSettings } from '@/lib/feature-settings'
import { resolveZoneForPoint, pickZoneDriver } from '@/lib/zones'
import { getSystemSettings, calculateDriverPay } from '@/lib/settings'
import { getDefaultHub } from '@/lib/hubs'

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

  // Current holder becomes the new event's from_holder. We grab the pay/zone
  // fields in the same round-trip so the hub-sort snapshot and per-leg pay
  // logic below don't each need their own query.
  const { data: deliveryRow } = await supabase
    .from('deliveries')
    .select(
      'current_holder, dropoff_zone_id, dropoff_lat, dropoff_lng, sorted_for_driver_id, pickup_driver_id, holder_driver_id, driver_id, pickup_pay, delivery_pay, is_rush, is_urgent, distance_km',
    )
    .eq('id', input.deliveryId)
    .maybeSingle()
  const dRow = deliveryRow as {
    current_holder: string | null
    dropoff_zone_id: string | null
    dropoff_lat: number | null
    dropoff_lng: number | null
    sorted_for_driver_id: string | null
    pickup_driver_id: string | null
    holder_driver_id: string | null
    driver_id: string | null
    pickup_pay: number | null
    delivery_pay: number | null
    is_rush: boolean | null
    is_urgent: boolean | null
    distance_km: number | null
  } | null
  const fromHolder = dRow?.current_holder ?? null

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
      const holderId = input.toHolder.slice('driver:'.length)
      patch.holder_driver_id = holderId
      // When a NEW driver takes ownership at the hub (or via a relay/transfer),
      // also move `driver_id` so the parcel shows up in that driver's Active
      // tab. The active list filters on driver_id, so without this the
      // destination driver would never see the cross-dock job they accepted.
      // `pickup_driver_id` is preserved separately, so per-leg pay is unaffected.
      if (
        input.eventType === 'hub_out' ||
        input.eventType === 'handoff' ||
        input.eventType === 'transfer_in'
      ) {
        patch.driver_id = holderId
      }
    } else {
      patch.holder_driver_id = null
    }
  }
  const nextLeg = legStatusForEvent(input.eventType)
  if (nextLeg) patch.leg_status = nextLeg

  // §4 Per-leg pay: permanently remember the PICKUP driver the first time a
  // parcel is picked up. holder_driver_id/driver_id get reassigned through the
  // hub and transfers, so without this the pickup driver would be lost.
  const pickupDriverId =
    dRow?.pickup_driver_id ??
    (input.eventType === 'pickup' && input.actorType === 'driver' ? input.actorId ?? null : null)
  if (input.eventType === 'pickup' && !dRow?.pickup_driver_id && input.actorType === 'driver' && input.actorId) {
    patch.pickup_driver_id = input.actorId
  }

  // §6 Hub sort: when a parcel is sorted in at the hub, snapshot the driver it
  // was sorted FOR (today's dropoff-zone driver). Locking this in at sort time
  // means a later zone reassignment can't retroactively rewrite who the parcel
  // was staged for. Only snapshot once.
  if (input.eventType === 'hub_in' && dRow && !dRow.sorted_for_driver_id && dRow.dropoff_zone_id) {
    // Snapshot the driver this parcel is sorted FOR using the configured
    // routing strategy (nearest/balanced/primary). Under "pool", this resolves
    // to null and the parcel is left unsorted-for until a driver claims it.
    const destDriverId = await pickZoneDriver(dRow.dropoff_zone_id, {
      pickupLat: dRow.dropoff_lat,
      pickupLng: dRow.dropoff_lng,
    }).catch(() => null)
    if (destDriverId) {
      const { data: drv } = await supabase
        .from('drivers')
        .select('name')
        .eq('id', destDriverId)
        .maybeSingle()
      patch.sorted_for_driver_id = destDriverId
      patch.sorted_for_driver_name = (drv as { name: string } | null)?.name ?? null
      patch.sorted_at = new Date().toISOString()
    }
  }

  if (Object.keys(patch).length > 0) {
    await supabase.from('deliveries').update(patch).eq('id', input.deliveryId)
  }

  // §4 Record the leg's earnings once the leg is complete. Idempotent: the
  // ledger has a unique (delivery_id, leg) index and the RPC is ON CONFLICT
  // DO NOTHING, so replays/duplicate scans never double-pay.
  if (input.eventType === 'pickup' || input.eventType === 'delivered') {
    await recordLegPay(supabase, input, dRow, pickupDriverId).catch((err) => {
      // Pay accounting must never break the custody scan itself.
      // eslint-disable-next-line no-console
      console.error('[pay] leg earning failed', err)
    })
  }

  return mapEvent(data as CustodyRow)
}

/**
 * A cross-dock pickup driver manually drops a parcel at the hub. Records a
 * `hub_in` custody event (leg -> at_hub, holder -> hub) so the parcel leaves
 * the pickup driver's queue and the hub-sort snapshot runs. Uses a
 * deterministic client_event_id so a double-tap collapses to one event.
 */
export async function dropParcelAtHub(input: {
  deliveryId: string
  driverId: string
  lat?: number | null
  lng?: number | null
}): Promise<CustodyEvent> {
  return recordCustodyEvent({
    deliveryId: input.deliveryId,
    eventType: 'hub_in',
    actorType: 'driver',
    actorId: input.driverId,
    toHolder: 'hub',
    scanMethod: 'manual',
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    clientEventId: `evt:${input.deliveryId}:hub_in`,
  })
}

type DeliveryPayFields = {
  holder_driver_id: string | null
  driver_id: string | null
  pickup_pay: number | null
  delivery_pay: number | null
  is_rush: boolean | null
  is_urgent: boolean | null
  distance_km: number | null
} | null

/**
 * Credit the driver who completed a leg. Honors feature_settings.driver_pay_model:
 *  - 'per_order': the delivering driver is paid the whole order on `delivered`.
 *  - 'per_leg':   the pickup driver is paid the pickup leg on `pickup`, and the
 *                 delivering driver the delivery leg on `delivered`. Explicit
 *                 per-delivery pickup_pay/delivery_pay override the computed split.
 */
async function recordLegPay(
  supabase: NonNullable<ReturnType<typeof createClient>>,
  input: RecordCustodyInput,
  dRow: DeliveryPayFields,
  pickupDriverId: string | null,
): Promise<void> {
  const [features, settings] = await Promise.all([getFeatureSettings(), getSystemSettings()])
  if (!settings.driver_pay_enabled) return

  const total = calculateDriverPay(settings, {
    is_rush: dRow?.is_rush ?? false,
    is_urgent: dRow?.is_urgent ?? false,
    distance_km: dRow?.distance_km ?? 0,
  })

  const credit = (driverId: string | null, leg: 'pickup' | 'delivery' | 'full', amount: number) => {
    if (!driverId || amount <= 0) return Promise.resolve()
    return supabase
      .rpc('record_driver_leg_earning', {
        p_delivery_id: input.deliveryId,
        p_driver_id: driverId,
        p_leg: leg,
        p_amount: Math.round(amount * 100) / 100,
        p_pay_model: features.driver_pay_model,
      })
      .then(() => undefined)
  }

  const deliveringDriver =
    (input.actorType === 'driver' ? input.actorId : null) ?? dRow?.holder_driver_id ?? dRow?.driver_id ?? null

  if (features.driver_pay_model === 'per_order') {
    // Whole order paid to the delivering driver, once, at delivery.
    if (input.eventType === 'delivered') await credit(deliveringDriver, 'full', total)
    return
  }

  // per_leg: split the total. Explicit per-delivery amounts win; otherwise the
  // base rate covers the pickup leg and the remainder (bonuses + distance) the
  // delivery leg.
  const pickupPay = dRow?.pickup_pay ?? Math.min(total, Math.round(settings.driver_base_rate * 100) / 100)
  const deliveryPay = dRow?.delivery_pay ?? Math.max(0, Math.round((total - pickupPay) * 100) / 100)

  if (input.eventType === 'pickup') {
    await credit(pickupDriverId, 'pickup', pickupPay)
  } else {
    await credit(deliveringDriver, 'delivery', deliveryPay)
  }
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
    // Honour the configured multi-driver routing strategy. With the "pool"
    // strategy, multi-driver zones intentionally resolve to null so the
    // delivery stays claimable. Single-driver zones resolve to that driver
    // under every strategy.
    const strategy = (await getFeatureSettings()).zone_routing_strategy
    ;[pickupDriverId, deliveryDriverId] = await Promise.all([
      pickupZoneId
        ? pickZoneDriver(pickupZoneId, {
            strategy,
            pickupLat: input.pickupLat,
            pickupLng: input.pickupLng,
          })
        : Promise.resolve(null),
      dropoffZoneId
        ? pickZoneDriver(dropoffZoneId, {
            strategy,
            pickupLat: input.dropoffLat,
            pickupLng: input.dropoffLng,
          })
        : Promise.resolve(null),
    ])
  }

  // Same driver owns both ends -> direct (no hub consolidation needed).
  const sameDriver =
    pickupDriverId !== null && pickupDriverId === deliveryDriverId
  const sameZone = pickupZoneId !== null && pickupZoneId === dropoffZoneId
  const routingMode: 'direct' | 'cross_dock' =
    sameDriver || sameZone ? 'direct' : 'cross_dock'

  const scanToken = await generateScanToken()

  // Cross-dock parcels route through a hub: stamp which one (the org default)
  // so the driver app can show its address + meet time. Direct jobs never hit a
  // hub, so they carry no hub_id.
  const hubId =
    routingMode === 'cross_dock'
      ? (await getDefaultHub().catch(() => null))?.id ?? null
      : null

  // For a direct job we can hand the pickup driver the whole leg; for
  // cross-dock the pickup driver carries it to the hub.
  const patch: Record<string, unknown> = {
    pickup_zone_id: pickupZoneId,
    dropoff_zone_id: dropoffZoneId,
    routing_mode: routingMode,
    scan_token: scanToken,
    leg_status: 'created',
    hub_id: hubId,
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
