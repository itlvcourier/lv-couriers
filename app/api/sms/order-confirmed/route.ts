import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Send confirmation to the business when their order is successfully posted.
 * Also sends tracking link to the recipient if phone is provided.
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
      `id, status, pickup_area, dropoff_area, recipient_name, recipient_phone,
       is_rush, is_urgent, businesses(id, name, phone)`,
    )
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      pickup_area: string | null
      dropoff_area: string | null
      recipient_name: string | null
      recipient_phone: string | null
      is_rush: boolean | null
      is_urgent: boolean | null
      businesses: { id: string; name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json(
      { error: error?.message || 'Delivery not found' },
      { status: 404 },
    )
  }

  console.log('[v0] sms.order-confirmed', {
    deliveryId,
    status: delivery.status,
    businessPhone: delivery.businesses?.phone,
    recipientPhone: delivery.recipient_phone,
  })

  const sends: Array<Promise<{ ok: boolean; reason?: string; role: string }>> = []
  const trackingUrl = buildTrackingUrl(deliveryId)
  const urgencyTag = delivery.is_urgent || delivery.is_rush ? '[RUSH] ' : ''
  const businessName = delivery.businesses?.name || 'LV Courier'

  // Notify business that their order was received
  if (delivery.businesses?.phone) {
    const bizMsg =
      `${urgencyTag}Order received!\n` +
      `Route: ${delivery.pickup_area || 'pickup'} → ${delivery.dropoff_area || 'dropoff'}\n` +
      `Recipient: ${delivery.recipient_name || 'N/A'}\n` +
      `We're finding a driver now.\n` +
      `Track: ${trackingUrl}`

    sends.push(
      sendSms({
        to: delivery.businesses.phone,
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

  // Send tracking link to recipient immediately so they can watch for the driver
  if (delivery.recipient_phone) {
    const recipientMsg =
      `Hi ${delivery.recipient_name || 'there'}, ` +
      `${businessName} has scheduled a delivery for you. ` +
      `Track your package: ${trackingUrl}\n\n— LV Couriers`

    sends.push(
      sendSms({
        to: delivery.recipient_phone,
        body: recipientMsg,
        type: 'tracking_link',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'recipient',
      })),
    )
  }

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No business or recipient phone' })
  }

  const results = await Promise.all(sends)
  console.log('[v0] sms.order-confirmed results', results)
  return NextResponse.json({ ok: true, results })
}

function buildTrackingUrl(deliveryId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    'http://localhost:3000'
  const normalized = base.startsWith('http') ? base : `https://${base}`
  return `${normalized.replace(/\/$/, '')}/track/${deliveryId}`
}
