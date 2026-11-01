import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { hashApiKey, PUBLIC_DELIVERY_COLUMNS, dispatchDeliveryEvent } from '@/lib/webhooks'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const limiter = rateLimit({ max: 120, windowMs: 60_000 })

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

function err(message: string, status: number) {
  return NextResponse.json({ error: { message } }, { status })
}

export async function GET(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return err('Invalid or missing API key', 401)
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429)

  const sp = req.nextUrl.searchParams
  const db = createAdminClient()
  const id = sp.get('id')
  const tracking = sp.get('tracking_code')
  let q = db.from('deliveries').select(PUBLIC_DELIVERY_COLUMNS).eq('business_id', auth.business_id)
  if (id) q = q.eq('id', id)
  if (tracking) q = q.eq('tracking_code', tracking)
  const status = sp.get('status')
  if (status) q = q.eq('status', status)
  const limit = Math.min(100, Math.max(1, Number(sp.get('limit')) || 25))
  const { data, error } = await q.order('created_at', { ascending: false }).limit(limit)
  if (error) return err('Query failed', 500)
  return NextResponse.json({ data: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await authenticate(req)
  if (!auth) return err('Invalid or missing API key', 401)
  if (!limiter.check(auth.id).ok) return err('Rate limit exceeded', 429)

  const b = (await req.json().catch(() => null)) as {
    location_id?: string; dropoff_address?: string; dropoff_area?: string; dropoff_postal_code?: string
    recipient_name?: string; recipient_phone?: string; recipient_note?: string
    is_rush?: boolean; require_signature?: boolean; require_pin?: boolean
  } | null
  if (!b?.dropoff_address?.trim() || !b.dropoff_area?.trim()) {
    return err('dropoff_address and dropoff_area are required', 400)
  }

  const db = createAdminClient()
  let locQ = db.from('business_locations').select('id, address, area, lat, lng').eq('business_id', auth.business_id)
  locQ = b.location_id ? locQ.eq('id', b.location_id) : locQ.order('is_default', { ascending: false })
  const { data: locs } = await locQ.limit(1)
  const loc = locs?.[0]
  if (!loc) return err('No matching pickup location for this account', 400)

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
      dropoff_address: b.dropoff_address.trim().slice(0, 300),
      dropoff_area: b.dropoff_area.trim().slice(0, 100),
      dropoff_postal_code: b.dropoff_postal_code?.slice(0, 12) ?? null,
      recipient_name: b.recipient_name?.slice(0, 120) ?? null,
      recipient_phone: b.recipient_phone?.slice(0, 30) ?? null,
      recipient_note: b.recipient_note?.slice(0, 500) ?? null,
      is_rush: !!b.is_rush,
      is_urgent: !!b.is_rush,
      is_out_of_town: false,
      require_signature: !!b.require_signature,
      require_photo: true,
      require_pin: !!b.require_pin,
      handoff_rule: 'door',
      handoff_set_by: 'business',
      posted_at: new Date().toISOString(),
      retry_count: 0,
    })
    .select(PUBLIC_DELIVERY_COLUMNS)
    .single()
  if (error) return err('Could not create delivery', 500)
  void dispatchDeliveryEvent((data as unknown as { id: string }).id).catch(() => {})
  return NextResponse.json({ data }, { status: 201 })
}
