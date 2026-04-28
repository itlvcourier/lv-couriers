import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

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
  })

  if (delivery.status !== 'delivered') {
    return NextResponse.json({
      ok: false,
      reason: `Delivery status is ${delivery.status}`,
    })
  }
  if (!delivery.recipient_phone) {
    return NextResponse.json({ ok: false, reason: 'No recipient phone on file' })
  }

  // Look up business name for friendlier copy.
  let businessName = 'LV Courier'
  if (delivery.business_id) {
    const { data: biz } = await supabase
      .from('businesses')
      .select('name')
      .eq('id', delivery.business_id)
      .maybeSingle<{ name: string }>()
    if (biz?.name) businessName = biz.name
  }

  const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}, your` : 'Your'
  const trackingUrl = buildTrackingUrl(deliveryId)
  const body_ = `${greeting} package from ${businessName} has been delivered. View proof: ${trackingUrl}\n\n— LV Couriers`

  const result = await sendSms({
    to: delivery.recipient_phone,
    body: body_,
    type: 'delivery_confirm',
    deliveryId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}

function buildTrackingUrl(deliveryId: string): string {
  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    'http://localhost:3000'
  const normalized = base.startsWith('http') ? base : `https://${base}`
  return `${normalized.replace(/\/$/, '')}/track/${deliveryId}`
}
