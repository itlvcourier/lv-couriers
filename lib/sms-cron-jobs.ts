import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'
import { createFeedbackToken } from '@/lib/db-extended'

/**
 * Reusable SMS cron jobs.
 *
 * These live in lib/ (rather than inline in a route) so the single daily
 * dispatcher at /api/cron/invoice-daily can run them alongside the invoice
 * jobs. The Vercel Hobby plan allows only 2 cron entries at once-per-day
 * frequency, so every scheduled job funnels through that one dispatcher.
 *
 * The standalone /api/cron/<job> routes remain as thin wrappers for manual
 * triggering and testing.
 */

export type ReviewRequestsResult = {
  ok: boolean
  due: number
  sent: number
  skipped: number
  reason?: string
  failures?: string[]
}

/**
 * Send queued review-request SMS messages whose delay has elapsed.
 *
 * completeDelivery() stamps review_request_due_at (now + review_request_delay_mins)
 * rather than texting immediately, so the customer isn't hit with two messages a
 * second apart. This sweep sends anything now due.
 *
 * Idempotency: review_request_sent_at is claimed before the send is attempted and
 * the query only picks rows where it is null — so a delivery can never be texted
 * twice even if two sweeps overlap.
 */
export async function runReviewRequests(): Promise<ReviewRequestsResult> {
  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_feedback_request')
    .limit(1)
    .maybeSingle<{ sms_notify_feedback_request: boolean | null }>()

  if (settings?.sms_notify_feedback_request === false) {
    return { ok: false, due: 0, sent: 0, skipped: 0, reason: 'Feedback requests are disabled' }
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
    throw new Error(error.message)
  }

  if (!due || due.length === 0) {
    return { ok: true, due: 0, sent: 0, skipped: 0 }
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
        // Pass the service-role client: this cron has no user session, and the
        // customer_feedback insert policy only allows the authenticated role.
        supabase,
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

  return {
    ok: true,
    due: due.length,
    sent,
    skipped,
    failures: failures.length ? failures : undefined,
  }
}

export type WeeklySummaryResult = {
  ok: boolean
  sent: number
  total?: number
  reason?: string
}

/**
 * Send a weekly delivery summary SMS to every active business.
 * Covers deliveries completed in the past 7 days, grouped per business.
 * Setting gate: sms_notify_weekly_summary (default OFF).
 */
export async function runWeeklySmsSummary(): Promise<WeeklySummaryResult> {
  const supabase = createAdminClient()

  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_weekly_summary')
    .limit(1)
    .maybeSingle<{ sms_notify_weekly_summary: boolean | null }>()

  if (!settings?.sms_notify_weekly_summary) {
    return { ok: false, sent: 0, reason: 'Weekly summary feature is disabled' }
  }

  const since = new Date()
  since.setDate(since.getDate() - 7)
  const sinceISO = since.toISOString()

  const { data: deliveries, error: dErr } = await supabase
    .from('deliveries')
    .select('id, business_id, status, delivered_at')
    .gte('delivered_at', sinceISO)
    .eq('status', 'delivered')

  if (dErr) throw new Error(dErr.message)

  const byBusiness = new Map<string, number>()
  for (const d of deliveries ?? []) {
    const count = byBusiness.get(d.business_id as string) ?? 0
    byBusiness.set(d.business_id as string, count + 1)
  }

  if (byBusiness.size === 0) {
    return { ok: true, sent: 0, reason: 'No deliveries in the past week' }
  }

  const businessIds = Array.from(byBusiness.keys())
  const { data: businesses, error: bErr } = await supabase
    .from('businesses')
    .select('id, name, phone')
    .in('id', businessIds)

  if (bErr) throw new Error(bErr.message)

  const weekLabel = `${since.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} – ${new Date().toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}`

  const sends: Array<Promise<{ ok: boolean; businessId: string }>> = []
  for (const biz of (businesses ?? []) as Array<{ id: string; name: string; phone: string | null }>) {
    if (!biz.phone) continue
    const count = byBusiness.get(biz.id) ?? 0
    sends.push(
      sendSms({
        to: biz.phone,
        body:
          `${biz.name} weekly summary (${weekLabel}): ` +
          `${count} ${count !== 1 ? 'deliveries' : 'delivery'} completed. ` +
          `Log in for details. — LV Couriers`,
        type: 'weekly_summary',
      }).then((r) => ({ ok: r.ok, businessId: biz.id })),
    )
  }

  const results = await Promise.all(sends)
  const sent = results.filter((r) => r.ok).length
  return { ok: true, sent, total: results.length }
}
