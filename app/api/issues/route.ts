import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

const TYPES = ['damaged', 'not_received', 'wrong_address', 'late', 'missing_items', 'driver_conduct', 'other'] as const

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  const db = createAdminClient()
  let q = db
    .from('delivery_issues')
    .select('id, delivery_id, business_id, issue_type, description, photo_url, status, resolution, credit_amount, created_at, resolved_at, businesses(name), deliveries(tracking_code, recipient_name, dropoff_address, driver_id)')
    .order('created_at', { ascending: false })
    .limit(200)
  if (auth.profile.role === 'business') {
    if (!auth.profile.business_id) return NextResponse.json({ issues: [] })
    q = q.eq('business_id', auth.profile.business_id)
  } else if (auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ issues: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'business' || !auth.profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  const body = (await req.json().catch(() => null)) as {
    deliveryId?: string; issueType?: string; description?: string; photoUrl?: string
  } | null
  if (!body?.deliveryId || !TYPES.includes(body.issueType as (typeof TYPES)[number])) {
    return NextResponse.json({ error: 'deliveryId and a valid issueType are required' }, { status: 400 })
  }
  const description = (body.description ?? '').toString().slice(0, 2000)

  const db = createAdminClient()
  const { data: delivery } = await db
    .from('deliveries')
    .select('id, business_id, tracking_code')
    .eq('id', body.deliveryId)
    .maybeSingle<{ id: string; business_id: string; tracking_code: string | null }>()
  if (!delivery || delivery.business_id !== auth.profile.business_id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: existing } = await db
    .from('delivery_issues')
    .select('id')
    .eq('delivery_id', delivery.id)
    .in('status', ['open', 'investigating'])
    .limit(1)
  if (existing?.length) {
    return NextResponse.json({ error: 'There is already an open case for this order.' }, { status: 409 })
  }

  const { data, error } = await db
    .from('delivery_issues')
    .insert({
      delivery_id: delivery.id,
      business_id: delivery.business_id,
      reported_by: auth.user.id,
      issue_type: body.issueType,
      description: description || null,
      photo_url: body.photoUrl?.startsWith('https://') ? body.photoUrl : null,
    })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await db.from('admin_notifications').insert({
    notification_type: 'delivery_issue',
    title: 'Problem reported by business',
    message: `${String(body.issueType).replace(/_/g, ' ')} on order ${delivery.tracking_code ?? delivery.id.slice(0, 8)}`,
    delivery_id: delivery.id,
    business_id: delivery.business_id,
    priority: 'high',
  }).then(({ error: e }) => { if (e) console.error('issue notification insert failed', e.message) })

  return NextResponse.json({ id: data.id })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = (await req.json().catch(() => null)) as {
    id?: string; status?: string; resolution?: string; creditAmount?: number | null
  } | null
  if (!body?.id || !['open', 'investigating', 'resolved', 'rejected'].includes(body.status ?? '')) {
    return NextResponse.json({ error: 'id and valid status required' }, { status: 400 })
  }
  const closed = body.status === 'resolved' || body.status === 'rejected'
  const credit = body.creditAmount != null && Number.isFinite(Number(body.creditAmount)) && Number(body.creditAmount) >= 0
    ? Math.round(Number(body.creditAmount) * 100) / 100
    : null
  const db = createAdminClient()
  const { error } = await db
    .from('delivery_issues')
    .update({
      status: body.status,
      resolution: body.resolution?.slice(0, 2000) ?? null,
      credit_amount: credit,
      resolved_by: closed ? auth.user.id : null,
      resolved_at: closed ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', body.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
