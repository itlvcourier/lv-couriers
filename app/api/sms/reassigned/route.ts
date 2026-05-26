import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'

/**
 * Notify all parties when a delivery is reassigned to a different driver.
 * Triggered: reassignDriver() in context.tsx
 * Recipients: new driver (job details), old driver (removed), business (updated)
 * Setting gate: sms_notify_reassigned
 */
export async function POST(req: Request) {
  let body: { deliveryId?: string; newDriverId?: string; oldDriverId?: string | null }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { deliveryId, newDriverId, oldDriverId } = body
  if (!deliveryId || !newDriverId) {
    return NextResponse.json({ error: 'deliveryId and newDriverId required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Check setting gate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_reassigned')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_reassigned === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, pickup_address, dropoff_address, recipient_name, businesses(name, phone)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      pickup_address: string | null
      dropoff_address: string | null
      recipient_name: string | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }

  // Fetch new driver details
  const { data: newDriver } = await supabase
    .from('drivers')
    .select('id, name, phone')
    .eq('id', newDriverId)
    .maybeSingle<{ id: string; name: string; phone: string | null }>()

  // Fetch old driver details if present
  const { data: oldDriver } = oldDriverId
    ? await supabase.from('drivers').select('id, name, phone').eq('id', oldDriverId).maybeSingle<{ id: string; name: string; phone: string | null }>()
    : { data: null }

  const businessName = delivery.businesses?.name || 'LV Couriers'
  const businessPhone = delivery.businesses?.phone || null
  const trackingUrl = buildTrackingUrl(deliveryId)
  const recipientLabel = delivery.recipient_name || 'recipient'

  const sends: Array<Promise<{ ok: boolean; role: string }>> = []

  // Notify new driver with full job details
  if (newDriver?.phone) {
    sends.push(
      sendSms({
        to: newDriver.phone,
        body:
          `Hi ${newDriver.name}, you've been assigned a delivery for ${businessName}. ` +
          `Pickup: ${delivery.pickup_address || 'see app'}. ` +
          `Dropoff: ${delivery.dropoff_address || 'see app'} (${recipientLabel}). ` +
          `Track: ${trackingUrl} — LV Couriers`,
        type: 'driver_reassigned',
        deliveryId,
        driverId: newDriver.id,
      }).then(r => ({ ok: r.ok, role: 'new-driver' })),
    )
  }

  // Notify old driver their job was removed
  if (oldDriver?.phone) {
    sends.push(
      sendSms({
        to: oldDriver.phone,
        body: `Hi ${oldDriver.name}, the delivery to ${recipientLabel} has been reassigned to another driver. Check the app for your current jobs. — LV Couriers`,
        type: 'driver_reassigned',
        deliveryId,
        driverId: oldDriver.id,
      }).then(r => ({ ok: r.ok, role: 'old-driver' })),
    )
  }

  // Notify business
  if (businessPhone && newDriver?.name) {
    sends.push(
      sendSms({
        to: businessPhone,
        body:
          `Driver update: ${newDriver.name} is now handling the delivery to ${recipientLabel}. ` +
          `Track: ${trackingUrl} — LV Couriers`,
        type: 'driver_reassigned',
        deliveryId,
      }).then(r => ({ ok: r.ok, role: 'business' })),
    )
  }

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No phones found for this reassignment' })
  }

  const results = await Promise.all(sends)
  return NextResponse.json({ ok: true, results })
}
