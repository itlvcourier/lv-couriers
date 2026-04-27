import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'

/**
 * Broadcast a "new job available" SMS to every on-duty driver.
 * Called from the business client right after a delivery is posted.
 *
 * Auth: must be called by an authenticated business or admin profile.
 * RLS-safe lookups use the admin client because we need to read driver phones
 * regardless of the caller's role.
 */
export async function POST(req: Request) {
  const userClient = await createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { data: profile } = await userClient
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle<{ role: string }>()
  if (!profile || (profile.role !== 'business' && profile.role !== 'admin')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { deliveryId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  const deliveryId = body.deliveryId
  if (!deliveryId) {
    return NextResponse.json({ error: 'deliveryId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load the delivery + business name in one round-trip.
  const { data: delivery, error: dErr } = await supabase
    .from('deliveries')
    .select(
      'id, status, pickup_area, dropoff_area, is_urgent, is_rush, businesses(name)',
    )
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      pickup_area: string | null
      dropoff_area: string | null
      is_urgent: boolean | null
      is_rush: boolean | null
      businesses: { name: string } | null
    }>()

  if (dErr || !delivery) {
    return NextResponse.json(
      { error: dErr?.message || 'Delivery not found' },
      { status: 404 },
    )
  }
  if (delivery.status !== 'posted') {
    return NextResponse.json({ ok: false, reason: 'Delivery is not posted' })
  }

  // Pull phone numbers for every active driver currently on-duty.
  const { data: drivers, error: drvErr } = await supabase
    .from('drivers')
    .select('id, name, phone, status')
    .in('status', ['idle', 'on_delivery'])
    .eq('invite_status', 'active')

  if (drvErr) {
    return NextResponse.json({ error: drvErr.message }, { status: 500 })
  }

  const recipients = (drivers || []).filter(d => !!d.phone)
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, note: 'no on-duty drivers' })
  }

  const businessName = delivery.businesses?.name || 'Lv Couriers'
  const urgencyTag = delivery.is_urgent || delivery.is_rush ? '[RUSH] ' : ''
  const message =
    `${urgencyTag}New job from ${businessName}: ${delivery.pickup_area || 'pickup'} → ${delivery.dropoff_area || 'dropoff'}. ` +
    `Open the driver app to claim.`

  let sent = 0
  let failed = 0
  await Promise.all(
    recipients.map(async d => {
      const r = await sendSms({
        to: d.phone!,
        body: message,
        type: 'pickup_alert',
        deliveryId,
      })
      if (r.ok) sent++
      else failed++
    }),
  )

  return NextResponse.json({ ok: true, sent, failed, total: recipients.length })
}
