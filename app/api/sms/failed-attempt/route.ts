import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms, buildTrackingUrl } from '@/lib/twilio'
import { renderSms } from '@/lib/sms-templates-server'

/**
 * Notify recipient and business when a delivery attempt fails.
 * Triggered: failDelivery() in context.tsx
 * Recipients: recipient (retry info) + business (status update)
 * Setting gate: sms_notify_failed_attempt
 */
export async function POST(req: NextRequest) {
  let body: { deliveryId?: string; reason?: string; retryCount?: number }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const deliveryId = body.deliveryId

  const auth = await requireDeliveryParty(req, deliveryId)
  if (isAuthError(auth)) return auth
  if (!deliveryId) return NextResponse.json({ error: 'deliveryId required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check setting gate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_failed_attempt')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_failed_attempt === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: delivery, error } = await supabase
    .from('deliveries')
    .select('id, status, recipient_name, recipient_phone, retry_count, businesses(name, phone)')
    .eq('id', deliveryId)
    .maybeSingle<{
      id: string
      status: string
      recipient_name: string | null
      recipient_phone: string | null
      retry_count: number | null
      businesses: { name: string; phone: string | null } | null
    }>()

  if (error || !delivery) {
    return NextResponse.json({ error: error?.message || 'Delivery not found' }, { status: 404 })
  }
  if (!delivery.status.startsWith('failed')) {
    return NextResponse.json({ ok: false, reason: `Status is ${delivery.status}` })
  }

  const businessName = delivery.businesses?.name || 'DOMS By Atria360'
  const businessPhone = delivery.businesses?.phone || null
  const trackingUrl = buildTrackingUrl(deliveryId)
  const retries = delivery.retry_count ?? 0
  // Must match record_delivery_failure(): 2 attempts, then dispatch.
  const maxRetries = 2
  const attemptsLeft = delivery.status === 'failed_permanent' ? 0 : Math.max(0, maxRetries - retries)

  const sends: Array<Promise<{ ok: boolean; role: string }>> = []

  // Notify recipient
  if (delivery.recipient_phone) {
    const greeting = delivery.recipient_name ? `Hi ${delivery.recipient_name}` : 'Hi'
    const recipMsg = attemptsLeft > 0
      ? await renderSms('failed_attempt.recipient_retry', {
          greeting,
          business_name: businessName,
          attempts_left_label: `${attemptsLeft} attempt${attemptsLeft !== 1 ? 's' : ''}`,
          tracking_url: trackingUrl,
        }, { deliveryId })
      : await renderSms('failed_attempt.recipient_final', {
          greeting,
          business_name: businessName,
          retries_label: `${retries} attempt${retries !== 1 ? 's' : ''}`,
          tracking_url: trackingUrl,
        }, { deliveryId })
    sends.push(
      sendSms({ to: delivery.recipient_phone, body: recipMsg, type: 'failed_attempt', deliveryId })
        .then(r => ({ ok: r.ok, role: 'recipient' })),
    )
  }

  // Notify business
  if (businessPhone) {
    const recipientLabel = delivery.recipient_name || 'recipient'
    const bizMsg = attemptsLeft > 0
      ? await renderSms('failed_attempt.business_retry', {
          recipient_name: recipientLabel,
          retries,
          max_retries: maxRetries,
          tracking_url: trackingUrl,
        }, { deliveryId })
      : await renderSms('failed_attempt.business_final', {
          recipient_name: recipientLabel,
          retries,
          tracking_url: trackingUrl,
        }, { deliveryId })
    sends.push(
      sendSms({ to: businessPhone, body: bizMsg, type: 'failed_attempt', deliveryId })
        .then(r => ({ ok: r.ok, role: 'business' })),
    )
  }

  if (sends.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No recipient or business phone' })
  }

  const results = await Promise.all(sends)
  return NextResponse.json({ ok: true, results })
}
