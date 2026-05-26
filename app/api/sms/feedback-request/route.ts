import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Send a post-delivery feedback request to the recipient.
 * Triggered: ~30 minutes after completeDelivery() via a short delay,
 * or optionally via a cron job for all deliveries completed in the past hour.
 * Recipients: recipient only
 * Setting gate: sms_notify_feedback_request
 * NOTE: No tracking link needed - simple feedback request
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
    .select('sms_notify_feedback_request')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_feedback_request === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, recipient_name, recipient_phone, businesses(name)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      recipient_phone: string | null
      businesses: { name: string } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }
  if (delivery.status !== 'delivered') {
    return NextResponse.json({ ok: false, reason: `Delivery status is ${delivery.status} — only send feedback for delivered` })
  }
  if (!delivery.recipient_phone) {
    return NextResponse.json({ ok: false, reason: 'No recipient phone' })
  }

  const businessName = delivery.businesses?.name || 'LV Couriers'
  const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}` : 'Hi'

  const result = await sendSms({
    to: delivery.recipient_phone,
    body:
      `${greeting}, how was your delivery from ${businessName}? ` +
      `We appreciate your feedback! Reply STOP to unsubscribe. — LV Couriers`,
    type: 'feedback_request',
    deliveryId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}
