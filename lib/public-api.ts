import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey, PUBLIC_DELIVERY_COLUMNS } from '@/lib/webhooks'

export const HANDOFF_RULES = ['door', 'recipient_only', 'recipient_or_named', 'reception', 'security', 'call_on_arrival'] as const
export const MANIFEST_TYPES = ['small_package', 'big_package'] as const

export interface ApiAuth {
  id: string
  business_id: string
}

export type ApiResult<T> =
  | { ok: true; data: T; status: number; replay?: boolean }
  | { ok: false; message: string; status: number; code?: string }

const fail = (message: string, status: number, code?: string): ApiResult<never> => ({ ok: false, message, status, code })

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const coord = (v: unknown, lim: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null)

export async function authenticateApiKey(authorization: string | null): Promise<ApiAuth | null> {
  const key = authorization?.match(/^Bearer\s+(doms_live_\S+)$/)?.[1]
  if (!key) return null
  const db = createAdminClient()
  const { data } = await db
    .from('api_keys')
    .select('id, business_id')
    .eq('key_hash', hashApiKey(key))
    .is('revoked_at', null)
    .maybeSingle<ApiAuth>()
  if (!data) return null
  void db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {})
  return data
}

export interface ListFilters {
  id?: string | null
  tracking_code?: string | null
  status?: string | null
  limit?: number | null
}

export async function listDeliveries(auth: ApiAuth, f: ListFilters): Promise<ApiResult<unknown[]>> {
  if (f.id && !UUID_RE.test(f.id)) return fail('id must be a UUID', 400, 'invalid_id')
  const db = createAdminClient()
  let q = db.from('deliveries').select(PUBLIC_DELIVERY_COLUMNS).eq('business_id', auth.business_id)
  if (f.id) q = q.eq('id', f.id)
  if (f.tracking_code) q = q.eq('tracking_code', f.tracking_code.slice(0, 40))
  if (f.status) q = q.eq('status', f.status.slice(0, 40))
  const limit = Math.min(100, Math.max(1, Number(f.limit) || 25))
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return fail('Query failed', 500)
  return { ok: true, data: data ?? [], status: 200 }
}

async function findByIdempotencyKey(auth: ApiAuth, key: string) {
  const { data } = await createAdminClient()
    .from('deliveries')
    .select(PUBLIC_DELIVERY_COLUMNS)
    .eq('business_id', auth.business_id)
    .eq('api_idempotency_key', key)
    .maybeSingle()
  return data
}

export async function createDelivery(
  auth: ApiAuth,
  b: Record<string, unknown>,
  idempotencyKey: string | null,
): Promise<ApiResult<unknown>> {
  const dropoffAddress = str(b.dropoff_address, 300)
  const dropoffArea = str(b.dropoff_area, 100)
  if (!dropoffAddress || !dropoffArea) return fail('dropoff_address and dropoff_area are required', 400, 'missing_fields')

  const idemKey = str(idempotencyKey, 100)
  if (idemKey) {
    const existing = await findByIdempotencyKey(auth, idemKey)
    if (existing) return { ok: true, data: existing, status: 200, replay: true }
  }

  const handoffRule = (HANDOFF_RULES as readonly string[]).includes(b.handoff_rule as string) ? (b.handoff_rule as string) : 'door'
  const requireId = b.handoff_require_id === true
  if (requireId && handoffRule === 'door') {
    return fail('handoff_require_id cannot be used with handoff_rule "door"', 400, 'invalid_handoff')
  }
  const namedPerson = str(b.handoff_named_person, 120)
  if (handoffRule === 'recipient_or_named' && !namedPerson) {
    return fail('handoff_named_person is required when handoff_rule is "recipient_or_named"', 400, 'invalid_handoff')
  }

  const rawItems = Array.isArray(b.items) ? b.items.slice(0, 50) : []
  const items = rawItems
    .map((i) => i as Record<string, unknown>)
    .filter((i) => i && (MANIFEST_TYPES as readonly string[]).includes(i.type as string))
    .map((i) => ({
      item_type: i.type as string,
      quantity: Math.min(999, Math.max(1, Math.floor(Number(i.quantity) || 1))),
      notes: str(i.notes, 200),
    }))

  const db = createAdminClient()
  let locQ = db.from('business_locations').select('id, address, area, lat, lng').eq('business_id', auth.business_id)
  const locationId = str(b.location_id, 40)
  locQ = locationId ? locQ.eq('id', locationId) : locQ.order('is_default', { ascending: false })
  const { data: locs } = await locQ.limit(1)
  const loc = locs?.[0]
  if (!loc) return fail('No matching pickup location for this account', 400, 'invalid_location')

  const now = new Date().toISOString()
  const isRush = b.is_rush === true
  const { data, error } = await db
    .from('deliveries')
    .insert({
      business_id: auth.business_id,
      location_id: loc.id,
      status: 'posted',
      pickup_address: loc.address,
      pickup_area: loc.area,
      pickup_lat: loc.lat,
      pickup_lng: loc.lng,
      dropoff_address: dropoffAddress,
      dropoff_area: dropoffArea,
      dropoff_postal_code: str(b.dropoff_postal_code, 12),
      dropoff_lat: coord(b.dropoff_lat, 90),
      dropoff_lng: coord(b.dropoff_lng, 180),
      recipient_name: str(b.recipient_name, 120),
      recipient_phone: str(b.recipient_phone, 30),
      recipient_note: str(b.recipient_note, 500),
      buzz_code: str(b.buzz_code, 40),
      is_rush: isRush,
      is_urgent: isRush,
      is_out_of_town: false,
      require_signature: b.require_signature === true,
      require_photo: true,
      require_pin: b.require_pin === true,
      handoff_rule: handoffRule,
      handoff_require_id: requireId,
      handoff_named_person: namedPerson,
      handoff_named_relationship: str(b.handoff_named_relationship, 60),
      handoff_location_note: str(b.handoff_location_note, 300),
      handoff_set_by: 'business',
      handoff_updated_at: now,
      posted_at: now,
      retry_count: 0,
      api_idempotency_key: idemKey,
    })
    .select(PUBLIC_DELIVERY_COLUMNS)
    .single()

  if (error) {
    // Two concurrent requests with the same key: the unique index rejects the second one.
    if (error.code === '23505' && idemKey) {
      const existing = await findByIdempotencyKey(auth, idemKey)
      if (existing) return { ok: true, data: existing, status: 200, replay: true }
    }
    return fail('Could not create delivery', 500)
  }

  const newId = (data as unknown as { id: string }).id
  if (items.length) {
    await db.from('manifest_items').insert(items.map((i) => ({ ...i, delivery_id: newId })))
  }
  return { ok: true, data, status: 201 }
}

/** Mirrors cancel_delivery_by_business: only unclaimed, posted orders can be cancelled by the business. */
export async function cancelDelivery(auth: ApiAuth, id: string, reason: string | null): Promise<ApiResult<unknown>> {
  if (!UUID_RE.test(id)) return fail('id must be a UUID', 400, 'invalid_id')
  const db = createAdminClient()
  const { data: d } = await db
    .from('deliveries')
    .select('id, status, driver_id, location_id')
    .eq('id', id)
    .eq('business_id', auth.business_id)
    .maybeSingle<{ id: string; status: string; driver_id: string | null; location_id: string | null }>()
  if (!d) return fail('Order not found', 404, 'not_found')
  if (d.status === 'cancelled') return fail('This order is already cancelled', 409, 'already_cancelled')
  if (d.status !== 'posted' || d.driver_id) {
    return fail('A courier has already taken this order. Contact dispatch to cancel.', 409, 'already_claimed')
  }

  const { data: rc } = await db
    .from('rate_cards')
    .select('cancel_before_depart')
    .eq('location_id', d.location_id)
    .order('effective_date', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle<{ cancel_before_depart: number | null }>()
  const fee = Math.max(0, Math.round((Number(rc?.cancel_before_depart) || 0) * 100) / 100)
  const finalReason = (str(reason, 500) ?? 'Cancelled by business via API (before claim)')

  // Conditional update so a courier claiming at the same moment wins and we never cancel a claimed order.
  const { data: updated, error } = await db
    .from('deliveries')
    .update({
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
      cancellation_stage: 'before_depart',
      cancellation_fee: fee,
      cancellation_reason: finalReason,
    })
    .eq('id', id)
    .eq('business_id', auth.business_id)
    .eq('status', 'posted')
    .is('driver_id', null)
    .select(PUBLIC_DELIVERY_COLUMNS)
    .maybeSingle()
  if (error) return fail('Could not cancel delivery', 500)
  if (!updated) return fail('A courier has already taken this order. Contact dispatch to cancel.', 409, 'already_claimed')
  return { ok: true, data: { delivery: updated, cancellation_fee: fee }, status: 200 }
}

export async function listLocations(auth: ApiAuth): Promise<ApiResult<unknown[]>> {
  const { data, error } = await createAdminClient()
    .from('business_locations')
    .select('id, name, address, area, is_default')
    .eq('business_id', auth.business_id)
    .order('is_default', { ascending: false })
  if (error) return fail('Query failed', 500)
  return { ok: true, data: data ?? [], status: 200 }
}
