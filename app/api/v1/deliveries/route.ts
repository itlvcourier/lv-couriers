import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey, PUBLIC_DELIVERY_COLUMNS } from '@/lib/webhooks'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const limiter = rateLimit({ max: 120, windowMs: 60_000 })

const HANDOFF_RULES = ['door', 'recipient_only', 'recipient_or_named', 'reception', 'security', 'call_on_arrival'] as const
const MANIFEST_TYPES = ['small_package', 'big_package'] as const

async function authenticate(req: NextRequest) {
  const key = req.headers.get('authorization')?.match(/^Bearer\s+(doms_live_\S+)$/)?.[1]
  if (!key) return null
  const db = createAdminClient()
  const { data } = await db
    .from('api_keys')
    .select('id, business_id')
    .eq('key_hash', hashApiKey(key))
    .is('revoked_at', null)
    .maybeSingle<{ id: string; business_id: string }>()
  if (!data) return null
  void db.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', data.id).then(() => {})
  return data
}

function err(message: string, status: number, code?: string) {
  return NextResponse.json({ error: { message, ...(code ? { code } : {}) } }, { status })
}

const str = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)
const coord = (v: unknown, lim: number) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim ? v : null)

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return err('Invalid or missing API key', 401, 'unauthorized')
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429, 'rate_limited')

  const sp = req.nextUrl.searchParams
  const db = createAdminClient()
  const id = sp.get('id')
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return err('id must be a UUID', 400, 'invalid_id')
  let q = db.from('deliveries').select(PUBLIC_DELIVERY_COLUMNS).eq('business_id', auth.business_id)
  if (id) q = q.eq('id', id)
  const tracking = sp.get('tracking_code')
  if (tracking) q = q.eq('tracking_code', tracking.slice(0, 40))
  const status = sp.get('status')
  if (status) q = q.eq('status', status.slice(0, 40))
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 25))
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return err('Query failed', 500)
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return err('Invalid or missing API key', 401, 'unauthorized')
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429, 'rate_limited')

  const b = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!b || typeof b !== 'object') return err('Body must be JSON', 400, 'invalid_json')

  const dropoffAddress = str(b.dropoff_address, 300)
  const dropoffArea = str(b.dropoff_area, 100)
  if (!dropoffAddress || !dropoffArea) return err('dropoff_address and dropoff_area are required', 400, 'missing_fields')

  const idemKey = str(req.headers.get('idempotency-key'), 100)
  const db = createAdminClient()

  if (idemKey) {
    const { data: existing } = await db
      .from('deliveries')
      .select(PUBLIC_DELIVERY_COLUMNS)
      .eq('business_id', auth.business_id)
      .eq('api_idempotency_key', idemKey)
      .maybeSingle()
    if (existing) return NextResponse.json({ data: existing, idempotent_replay: true }, { status: 200 })
  }

  const handoffRule = (HANDOFF_RULES as readonly string[]).includes(b.handoff_rule as string)
    ? (b.handoff_rule as string)
    : 'door'
  const requireId = b.handoff_require_id === true
  if (requireId && handoffRule === 'door') {
    return err('handoff_require_id cannot be used with handoff_rule "door"', 400, 'invalid_handoff')
  }
  const namedPerson = str(b.handoff_named_person, 120)
  if (handoffRule === 'recipient_or_named' && !namedPerson) {
    return err('handoff_named_person is required when handoff_rule is "recipient_or_named"', 400, 'invalid_handoff')
  }

  const rawItems = Array.isArray(b.items) ? b.items.slice(0, 50) : []
  const items = rawItems
    .map((i) => i as Record<string, unknown>)
    .filter((i) => (MANIFEST_TYPES as readonly string[]).includes(i.type as string))
    .map((i) => ({
      item_type: i.type as string,
      quantity: Math.min(999, Math.max(1, Math.floor(Number(i.quantity) || 1))),
      notes: str(i.notes, 200),
    }))

  let locQ = db.from('business_locations').select('id, address, area, lat, lng').eq('business_id', auth.business_id)
  const locationId = str(b.location_id, 40)
  locQ = locationId ? locQ.eq('id', locationId) : locQ.order('is_default', { ascending: false })
  const { data: locs } = await locQ.limit(1)
  const loc = locs?.[0]
  if (!loc) return err('No matching pickup location for this account', 400, 'invalid_location')

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
      const { data: existing } = await db
        .from('deliveries')
        .select(PUBLIC_DELIVERY_COLUMNS)
        .eq('business_id', auth.business_id)
        .eq('api_idempotency_key', idemKey)
        .maybeSingle()
      if (existing) return NextResponse.json({ data: existing, idempotent_replay: true }, { status: 200 })
    }
    return err('Could not create delivery', 500)
  }

  const newId = (data as unknown as { id: string }).id
  if (items.length) {
    await db.from('manifest_items').insert(items.map((i) => ({ ...i, delivery_id: newId })))
  }
  return NextResponse.json({ data }, { status: 201 })
}
