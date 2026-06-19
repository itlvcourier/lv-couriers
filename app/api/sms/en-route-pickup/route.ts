import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'

/**
 * Notify business when driver is en route to pick up the package.
 * Triggered: advanceStatus → 'en_route_pickup'
 * Recipients: business only (recipient doesn't need this notification)
 * Setting gate: sms_notify_en_route_pickup
 */
export async function POST(req: Request) {
  let body: { deliveryId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const deliveryId = body.deliveryId
  if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check setting gate first
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_en_route_pickup')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_en_route_pickup === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, pickup_address, driver_id, drivers!deliveries_driver_id_fkey(name, phone), businesses(name, phone)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      pickup_address: string | null
      driver_id: string | null
      drivers: { name: string; phone: string | null } | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }
  if (delivery.status !== 'en_route_pickup') {
    return NextResponse.json({ ok: false, reason: `Status is ${delivery.status}` })
  }

  const businessPhone = delivery.businesses?.phone || null
  if (!businessPhone) {
    return NextResponse.json({ ok: false, reason: 'No business phone on file' })
  }

  const driverName = delivery.drivers?.name || 'Your driver'
  const trackingUrl = buildTrackingUrl(deliveryId)
  const msg =
    `${driverName} is on the way to pick up your package at ` +
    `${delivery.pickup_address || 'your location'}. ` +
    `Track: ${trackingUrl} — LV Couriers`

  const result = await sendSms({
    to: businessPhone,
    body: msg,
    type: 'en_route_pickup',
    deliveryId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}
