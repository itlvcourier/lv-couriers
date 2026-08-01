import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const jobAlertLimiter = rateLimit({ max: 20, windowMs: 60 * 60 * 1000 })

/**
 * Broadcast a "new job available" SMS to every on-duty driver.
 * Called from the business client right after a delivery is posted.
 * Requires any authenticated user — the DB join verifies the delivery
 * exists and is in 'posted' state before any SMS is sent.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth

  const ip = getClientIp(req)
  const limit = jobAlertLimiter.check(ip)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    )
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
  // driver_status enum is: available | on_delivery | off_duty
  // We broadcast to everyone except off_duty so on-delivery drivers also see queued work.
  const { data: drivers, error: drvErr } = await supabase
    .from('drivers')
    .select('id, name, phone, status')
    .in('status', ['available', 'on_delivery'])
    .eq('invite_status', 'active')

  if (drvErr) {
    return NextResponse.json({ error: drvErr.message }, { status: 500 })
  }

  const recipients = (drivers || []).filter(d => !!d.phone)
  if (recipients.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, failed: 0, note: 'no on-duty drivers' })
  }

  const businessName = delivery.businesses?.name || 'LV Couriers'
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
