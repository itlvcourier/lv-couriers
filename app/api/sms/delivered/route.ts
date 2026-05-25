import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'

/**
 * Send a "your package has been delivered" SMS to the recipient.
 * Triggered when a driver completes a delivery (status -> 'delivered').
 *
 * Auth: matches the rest of the app's demo-mode posture — the delivery row
 * itself is the authority. Server-only validation:
 * - Delivery must exist
 * - Status must be 'delivered'
 * - Recipient phone must be present
 */
export async function POST(req: Request) {
  let body: { deliveryId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const deliveryId = body.deliveryId
  if (!deliveryId) {
    return NextResponse.json({ error: 'deliveryId is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: delivery, error: dErr } = await supabase
    .from('deliveries')
    .select('id, status, recipient_phone, recipient_name, business_id')
    .eq('id', deliveryId)
    .maybeSingle()

  if (dErr || !delivery) {
    return NextResponse.json(
      { error: dErr?.message || 'Delivery not found' },
      { status: 404 },
    )
  }

  console.log('[v0] sms.delivered loaded', {
    deliveryId,
    status: delivery.status,
    hasRecipientPhone: !!delivery.recipient_phone,
    businessId: delivery.business_id,
  })

  if (delivery.status !== 'delivered') {
    return NextResponse.json({
      ok: false,
      reason: `Delivery status is ${delivery.status}`,
    })
  }

  // Look up business name + phone so we can also notify them.
  let businessName = 'LV Courier'
  let businessPhone: string | null = null
  if (delivery.business_id) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name, phone')
      .eq('id', delivery.business_id)
      .maybeSingle<{ name: string; phone: string | null }>()
    if (biz?.name) businessName = biz.name
    if (biz?.phone) businessPhone = biz.phone
    console.log('[v0] sms.delivered business lookup', {
      businessId: delivery.business_id,
      businessName,
      businessPhone,
    })
  }

  // At least one phone must be present
  if (!delivery.recipient_phone && !businessPhone) {
    return NextResponse.json({ ok: false, reason: 'No recipient or business phone' })
  }

  const trackingUrl = buildTrackingUrl(deliveryId)
  const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}, your` : 'Your'

  // Send to recipient + business in parallel. Both get the same tracking link
  // which renders the proof photo and signature so each side has a verifiable
  // record of completion.
  const sends: Array<Promise<{ ok: boolean; reason?: string; role: string }>> = []

  if (delivery.recipient_phone) {
    const recipMsg = `${greeting} package from ${businessName} has been delivered. View proof: ${trackingUrl}\n\n— LV Couriers`
    sends.push(
      sendSms({
        to: delivery.recipient_phone,
        body: recipMsg,
        type: 'delivery_confirm',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'recipient',
      })),
    )
  }

  if (businessPhone) {
    const recipientLabel = delivery.recipient_name || 'recipient'
    const bizMsg =
      `Delivery to ${recipientLabel} completed. ` +
      `View proof of delivery (photo + signature): ${trackingUrl}\n\n— LV Couriers`
    sends.push(
      sendSms({
        to: businessPhone,
        body: bizMsg,
        type: 'delivery_confirm',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'business',
      })),
    )
  }

  const results = await Promise.all(sends)
  console.log('[v0] sms.delivered results', results)
  return NextResponse.json({ ok: true, results })
}
