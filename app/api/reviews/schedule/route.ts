import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Stamp a delivery as due for a review-request SMS.
 *
 * Called by completeDelivery(). We deliberately do NOT send the SMS here —
 * doing so lands a second text within a second of the "delivered" one, before
 * the customer has even taken the parcel inside. Instead we record when the
 * request becomes eligible; /api/cron/review-requests sweeps and sends it.
 *
 * Delay is admin-controlled via system_settings.review_request_delay_mins.
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

  const { data: settings } = await supabase
    .from('system_settings')
    .select(
      'sms_notify_feedback_request, review_request_delay_mins, tracking_link_expiry_hours',
    )
    .limit(1)
    .maybeSingle<{
      sms_notify_feedback_request: boolean | null
      review_request_delay_mins: number | null
      tracking_link_expiry_hours: number | null
    }>()

  // Start the clock on the public tracking link. There is no DB default for
  // tracking_expires_at, so without this a link would stay live forever — and
  // it exposes recipient name, address and proof-of-delivery images to anyone
  // holding the URL. Do this before any early return below.
  const expiryHours = Math.max(1, settings?.tracking_link_expiry_hours ?? 24)
  await supabase
    .from('deliveries')
    .update({
      tracking_expires_at: new Date(Date.now() + expiryHours * 3_600_000).toISOString(),
    })
    .eq('id', deliveryId)
    .eq('status', 'delivered')
    .is('tracking_expires_at', null)

  // Respect the master gate so we don't queue work the sweep would discard.
  if (settings?.sms_notify_feedback_request === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const delayMins = Math.max(0, settings?.review_request_delay_mins ?? 30)
  const dueAt = new Date(Date.now() + delayMins * 60_000).toISOString()

  // Only stamp deliveries that are actually delivered and have somewhere to
  // text. `review_request_sent_at is null` keeps a re-completed delivery from
  // queuing a duplicate.
  const { data, error } = await supabase
    .from('deliveries')
    .update({ review_request_due_at: dueAt })
    .eq('id', deliveryId)
    .eq('status', 'delivered')
    .is('review_request_sent_at', null)
    .not('recipient_phone', 'is', null)
    .select('id')

  if (error) {
    console.error('review-schedule: DB update failed:', error.message)
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
  }

  if (!data || data.length === 0) {
    return NextResponse.json({
      ok: false,
      reason: 'Not eligible (not delivered, already sent, or no recipient phone)',
    })
  }

  return NextResponse.json({ ok: true, dueAt, delayMins })
}
