import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'
import { createFeedbackToken } from '@/lib/db-extended'

/**
 * Cron: send queued review-request SMS messages whose delay has elapsed.
 *
 * completeDelivery() stamps review_request_due_at (now + review_request_delay_mins)
 * rather than texting immediately, so the customer isn't hit with two messages
 * a second apart. This sweep sends anything now due.
 *
 * Schedule: every 15 minutes (see vercel.json)
 * Setting gate: sms_notify_feedback_request
 * Auth: CRON_SECRET header required
 *
 * Idempotency: review_request_sent_at is set before the send is attempted, and
 * the query only picks rows where it is null — so a delivery can never be
 * texted twice even if two sweeps overlap.
 */
export async function GET(req: Request) {
  const secret =
    req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '')
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_feedback_request')
    .limit(1)
    .maybeSingle<{ sms_notify_feedback_request: boolean | null }>()

  if (settings?.sms_notify_feedback_request === false) {
    return NextResponse.json({ ok: false, reason: 'Feedback requests are disabled' })
  }

  const nowISO = new Date().toISOString()

  const { data: due, error } = await supabase
    .from('deliveries')
    .select(
      'id, recipient_name, recipient_phone, driver_id, business_id, location_id, businesses(name)',
    )
    .eq('status', 'delivered')
    .not('review_request_due_at', 'is', null)
    .is('review_request_sent_at', null)
    .lte('review_request_due_at', nowISO)
    .limit(100)
    .returns<
      {
        id: string
        recipient_name: string | null
        recipient_phone: string | null
        driver_id: string | null
        business_id: string
        location_id: string
        businesses: { name: string } | null
      }[]
    >()

  if (error) {
    console.error('[v0] review-requests sweep query failed', error.message)
    return NextResponse.json({ ok: false, reason: error.message }, { status: 500 })
  }

  if (!due || due.length === 0) {
    return NextResponse.json({ ok: true, due: 0, sent: 0 })
  }

  let sent = 0
  let skipped = 0
  const failures: string[] = []

  for (const delivery of due) {
    if (!delivery.recipient_phone || !delivery.driver_id) {
      // Nothing we can do with these — clear the flag so the sweep doesn't
      // keep re-reading them on every run.
      await supabase
        .from('deliveries')
        .update({ review_request_sent_at: nowISO })
        .eq('id', delivery.id)
      skipped++
      continue
    }

    // Claim the row *before* sending. If the send then fails we accept losing
    // that one review request rather than risk texting a customer twice.
    const { data: claimed } = await supabase
      .from('deliveries')
      .update({ review_request_sent_at: new Date().toISOString() })
      .eq('id', delivery.id)
      .is('review_request_sent_at', null)
      .select('id')

    if (!claimed || claimed.length === 0) {
      // Another concurrent sweep already took it.
      continue
    }

    try {
      const token = await createFeedbackToken(
        delivery.id,
        delivery.driver_id,
        delivery.business_id,
        delivery.location_id,
      )
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://lvcourier.ca'
      const feedbackUrl = `${baseUrl}/feedback/${token}`
      const businessName = delivery.businesses?.name || 'LV Couriers'
      const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}` : 'Hi'

      const result = await sendSms({
        to: delivery.recipient_phone,
        body:
          `${greeting}, how was your delivery from ${businessName}? ` +
          `Share your feedback here: ${feedbackUrl} ` +
          `(link expires in 7 days)\n` +
          `Reply STOP to unsubscribe. — LV Couriers`,
        type: 'feedback_request',
        deliveryId: delivery.id,
      })

      if (result.ok) sent++
      else failures.push(`${delivery.id}: ${result.reason ?? 'send failed'}`)
    } catch (err) {
      failures.push(`${delivery.id}: ${err instanceof Error ? err.message : 'unknown error'}`)
    }
  }

  return NextResponse.json({
    ok: true,
    due: due.length,
    sent,
    skipped,
    failures: failures.length ? failures : undefined,
  })
}
