import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { sendSms } from '@/lib/twilio'

/**
 * Send a "your package is on its way" SMS to the recipient.
 * Triggered when a driver advances a delivery to en_route_dropoff.
 *
 * Auth: any authenticated profile may trigger (driver/business/admin) – the
 * delivery itself is the authority. Server-only validation prevents abuse:
 * - Delivery must exist
 * - Status must be 'en_route_dropoff' (we won't blast SMS for other states)
 * - Recipient phone must be present
 */
export async function POST(req: Request) {
  const userClient = await createServerClient()
  const { data: { user } } = await userClient.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select(
      'id, status, recipient_name, recipient_phone, dropoff_address, businesses(name)',
    )
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      recipient_phone: string | null
      dropoff_address: string | null
      businesses: { name: string } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json(
      { error: error?.message || 'Delivery not found' },
      { status: 404 },
    )
  }
  if (delivery.status !== 'en_route_dropoff') {
    return NextResponse.json({
      ok: false,
      reason: `Delivery status is ${delivery.status}`,
    })
  }
  if (!delivery.recipient_phone) {
    return NextResponse.json({ ok: false, reason: 'No recipient phone on file' })
  }

  const businessName = delivery.businesses?.name || 'Lv Couriers'
  const recipientName = delivery.recipient_name || 'there'
  const message =
    `Hi ${recipientName}, your package from ${businessName} is on its way. ` +
    `We'll be at ${delivery.dropoff_address || 'your address'} shortly.`

  const r = await sendSms({
    to: delivery.recipient_phone,
    body: message,
    type: 'tracking_link',
    deliveryId,
  })

  if (!r.ok) {
    return NextResponse.json({ ok: false, reason: r.reason }, { status: 502 })
  }
  return NextResponse.json({ ok: true, sid: r.sid, redirected: r.redirected })
}
