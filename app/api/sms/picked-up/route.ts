import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'

/**
 * Notify business when driver has picked up the package.
 * Triggered: advanceStatus → 'picked_up'
 * Recipients: business (confirmation it left their location)
 * Setting gate: sms_notify_picked_up
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
    .select('sms_notify_picked_up')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_picked_up === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, recipient_name, dropoff_address, driver_id, drivers(name), businesses(name, phone)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      dropoff_address: string | null
      driver_id: string | null
      drivers: { name: string } | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }
  if (delivery.status !== 'picked_up') {
    return NextResponse.json({ ok: false, reason: `Status is ${delivery.status}` })
  }

  const businessPhone = delivery.businesses?.phone || null
  if (!businessPhone) {
    return NextResponse.json({ ok: false, reason: 'No business phone on file' })
  }

  const driverName = delivery.drivers?.name || 'Driver'
  const recipientLabel = delivery.recipient_name || 'recipient'
  const trackingUrl = buildTrackingUrl(deliveryId)
  const msg =
    `Package picked up by ${driverName}. ` +
    `Now heading to ${recipientLabel} at ${delivery.dropoff_address || 'destination'}. ` +
    `Track: ${trackingUrl} — LV Couriers`

  const result = await sendSms({
    to: businessPhone,
    body: msg,
    type: 'picked_up_confirm',
    deliveryId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}
