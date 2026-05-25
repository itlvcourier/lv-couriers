import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'

/**
 * Send a "your package is on its way" SMS to the recipient.
 * Triggered when a driver advances a delivery to en_route_dropoff.
 *
 * Auth: matches the rest of the app's demo-mode posture — the delivery row
 * itself is the authority. Server-only validation prevents abuse:
 * - Delivery must exist
 * - Status must be 'en_route_dropoff' (we won't blast SMS for other states)
 * - Recipient phone must be present
 */
export async function POST(req: Request) {
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
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select(
      'id, status, recipient_name, recipient_phone, dropoff_address, businesses(name, phone)',
    )
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      recipient_phone: string | null
      dropoff_address: string | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json(
      { error: error?.message || 'Delivery not found' },
      { status: 404 },
    )
  }
  console.log('[v0] sms.pickup-ready loaded', {
    deliveryId,
    status: delivery.status,
    hasRecipientPhone: !!delivery.recipient_phone,
    hasBusinessPhone: !!delivery.businesses?.phone,
  })
  if (delivery.status !== 'en_route_dropoff') {
    return NextResponse.json({
      ok: false,
      reason: `Delivery status is ${delivery.status}`,
    })
  }

  const businessName = delivery.businesses?.name || 'Lv Couriers'
  const businessPhone = delivery.businesses?.phone || null
  const recipientName = delivery.recipient_name || 'there'
  const trackingUrl = buildTrackingUrl(deliveryId)

  // Send to recipient + business in parallel. The business gets the same
  // tracking link so they can monitor progress to the recipient address.
  const sends: Array<Promise<{ ok: boolean; reason?: string; role: string }>> = []

  if (delivery.recipient_phone) {
    const recipMsg =
      `Hi ${recipientName}, your package from ${businessName} is on its way. ` +
      `We'll be at ${delivery.dropoff_address || 'your address'} shortly. ` +
      `Track live: ${trackingUrl}`
    sends.push(
      sendSms({
        to: delivery.recipient_phone,
        body: recipMsg,
        type: 'tracking_link',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'recipient',
      })),
    )
  }

  if (businessPhone) {
    const bizMsg =
      `Driver is en route to ${recipientName} (${businessName}). ` +
      `Address: ${delivery.dropoff_address || 'recipient address'}. ` +
      `Live tracking: ${trackingUrl}`
    sends.push(
      sendSms({
        to: businessPhone,
        body: bizMsg,
        type: 'tracking_link',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'business',
      })),
    )
  }

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No recipient or business phone' })
  }

  const results = await Promise.all(sends)
  console.log('[v0] sms.pickup-ready results', results)
  return NextResponse.json({ ok: true, results })
}
