import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Notify the driver when they are assigned to a delivery.
 * Called from the client context when claimDelivery completes.
 *
 * Also notifies the business that a driver has been assigned.
 * NOTE: No tracking link - customer already has the persistent link from order-confirmed
 */
export async function POST(req: Request) {
  let body: { deliveryId?: string; driverId?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { deliveryId, driverId } = body
  if (!deliveryId || !driverId) {
    return NextResponse.json(
      { error: 'deliveryId and driverId required' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Load delivery details
  const { data: delivery, error: dErr } = await supabase
    .from('deliveries')
    .select(
      `id, status, pickup_address, pickup_area, dropoff_address, dropoff_area,
       recipient_name, recipient_phone, is_rush, is_urgent, businesses(id, name, phone)`,
    )
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      pickup_address: string | null
      pickup_area: string | null
      dropoff_address: string | null
      dropoff_area: string | null
      recipient_name: string | null
      recipient_phone: string | null
      is_rush: boolean | null
      is_urgent: boolean | null
      businesses: { id: string; name: string; phone: string | null } | null
    }>()

  if (dErr || !delivery) {
    return NextResponse.json(
      { error: dErr?.message || 'Delivery not found' },
      { status: 404 },
    )
  }

  // Load driver details
  const { data: driver, error: drErr } = await supabase
    .from('drivers')
    .select('id, name, phone')
    .eq('id', driverId)
    .maybeSingle<{ id: string; name: string; phone: string | null }>()

  if (drErr || !driver) {
    return NextResponse.json(
      { error: drErr?.message || 'Driver not found' },
      { status: 404 },
    )
  }

  console.log('[v0] sms.driver-assigned', {
    deliveryId,
    driverId,
    driverPhone: driver.phone,
    businessPhone: delivery.businesses?.phone,
  })

  const sends: Array<Promise<{ ok: boolean; reason?: string; role: string }>> = []
  const urgencyTag = delivery.is_urgent || delivery.is_rush ? '[RUSH] ' : ''
  const businessName = delivery.businesses?.name || 'LV Courier'

  // Notify driver with pickup/dropoff details
  if (driver.phone) {
    const driverMsg =
      `${urgencyTag}Job assigned from ${businessName}.\n` +
      `Pickup: ${delivery.pickup_address || delivery.pickup_area || 'See app'}\n` +
      `Dropoff: ${delivery.dropoff_address || delivery.dropoff_area || 'See app'}\n` +
      `Recipient: ${delivery.recipient_name || 'N/A'}` +
      (delivery.recipient_phone ? ` (${delivery.recipient_phone})` : '') +
      ` — LV Couriers`

    sends.push(
      sendSms({
        to: driver.phone,
        body: driverMsg,
        type: 'pickup_alert',
        deliveryId,
      }).then(r => ({
        ok: r.ok,
        reason: r.ok ? undefined : r.reason,
        role: 'driver',
      })),
    )
  }

  // Notify business that a driver has been assigned
  if (delivery.businesses?.phone) {
    const bizMsg =
      `Driver ${driver.name} has been assigned to your delivery.\n` +
      `Route: ${delivery.pickup_area || 'pickup'} → ${delivery.dropoff_area || 'dropoff'}\n` +
      `Recipient: ${delivery.recipient_name || 'N/A'} — LV Couriers`

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

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No driver or business phone' })
  }

  const results = await Promise.all(sends)
  console.log('[v0] sms.driver-assigned results', results)
  return NextResponse.json({ ok: true, results })
}
