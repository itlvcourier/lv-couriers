import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Notify all parties when a delivery is cancelled.
 * Triggered: cancelDelivery() in context.tsx
 * Recipients: recipient, business, and assigned driver (if any)
 * Setting gate: sms_notify_cancelled
 */
export async function POST(req: Request) {
  let body: { deliveryId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const deliveryId = body.deliveryId
  if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check setting gate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_cancelled')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_cancelled === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, recipient_name, recipient_phone, driver_id, drivers!deliveries_driver_id_fkey(name, phone), businesses(name, phone)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      recipient_phone: string | null
      driver_id: string | null
      drivers: { name: string; phone: string | null } | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }
  if (delivery.status !== 'cancelled') {
    return NextResponse.json({ ok: false, reason: `Status is ${delivery.status}` })
  }

  const businessName = delivery.businesses?.name || 'LV Couriers'
  const businessPhone = delivery.businesses?.phone || null
  const driverPhone = delivery.drivers?.phone || null
  const driverName = delivery.drivers?.name || 'Driver'

  const sends: Array<Promise<{ ok: boolean; role: string }>> = []

  // Notify recipient (if they have a phone)
  if (delivery.recipient_phone) {
    const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}` : 'Hi'
    sends.push(
      sendSms({
        to: delivery.recipient_phone,
        body: `${greeting}, your delivery from ${businessName} has been cancelled. If this is unexpected, please contact ${businessName} directly. — LV Couriers`,
        type: 'order_cancelled',
        deliveryId,
      }).then(r => ({ ok: r.ok, role: 'recipient' })),
    )
  }

  // Notify business
  if (businessPhone) {
    const recipientLabel = delivery.recipient_name || 'recipient'
    sends.push(
      sendSms({
        to: businessPhone,
        body: `Your delivery to ${recipientLabel} has been cancelled. Contact LV Couriers if you have questions. — LV Couriers`,
        type: 'order_cancelled',
        deliveryId,
      }).then(r => ({ ok: r.ok, role: 'business' })),
    )
  }

  // Notify driver if they were assigned
  if (driverPhone && delivery.driver_id) {
    sends.push(
      sendSms({
        to: driverPhone,
        body: `${driverName}, the delivery you were assigned has been cancelled. Please check the app for your updated job list. — LV Couriers`,
        type: 'order_cancelled',
        deliveryId,
        driverId: delivery.driver_id,
      }).then(r => ({ ok: r.ok, role: 'driver' })),
    )
  }

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No phones on file for this delivery' })
  }

  const results = await Promise.all(sends)
  return NextResponse.json({ ok: true, results })
}
