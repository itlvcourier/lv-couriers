import 'server-only'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * SMS adapter wrapping Twilio.
 *
 * - Server-only. Never import from a Client Component.
 * - Honors SMS_TEST_RECIPIENT: when set, every outbound SMS is redirected
 *   to that single phone number. The original recipient is prepended to the
 *   message body so we know who it would have gone to. This lets us test
 *   broadcast flows on a Twilio trial account where only verified numbers
 *   can receive messages.
 * - Records every send (success OR failure) in public.sms_log so the admin
 *   SMS Logs view stays the source of truth.
 */

export type SmsType =
  | 'pickup_alert'
  | 'tracking_link'
  | 'delivery_confirm'
  | 'failed_attempt'
  | 'invoice_reminder'
  | 'overdue_notice'

export type SendSmsInput = {
  to: string
  body: string
  type: SmsType
  /** Optional FK – persisted so we can correlate SMS to the delivery. */
  deliveryId?: string | null
  /** Optional FK – persisted so we can correlate SMS to the invoice. */
  invoiceId?: string | null
  /**
   * When true, the send is NOT recorded in public.sms_log. Use for
   * non-delivery messages such as driver invites, where the sms_type enum
   * doesn't have a fitting value.
   */
  skipLog?: boolean
}

export type SendSmsResult =
  | { ok: true; sid: string; redirected: boolean }
  | { ok: false; reason: string; logged: boolean }

let _client: ReturnType<typeof twilio> | null = null
function getClient(): ReturnType<typeof twilio> | null {
  const sid = process.env.TWILIO_ACCOUNT_SID
  const token = process.env.TWILIO_AUTH_TOKEN
  if (!sid || !token) return null
  if (!_client) _client = twilio(sid, token)
  return _client
}

function getSender(): { from?: string; messagingServiceSid?: string } | null {
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID
  if (messagingServiceSid) return { messagingServiceSid }
  const from = process.env.TWILIO_FROM_NUMBER
  if (from) return { from }
  return null
}

/** Naive E.164 normalizer: strips spaces / dashes / parens; defaults to +1 prefix when bare 10 digits. */
function normalize(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  return cleaned
}

async function recordSms(opts: {
  to: string
  body: string
  type: SmsType
  status: 'sent' | 'failed'
  providerMessageId: string | null
  errorMessage: string | null
  deliveryId: string | null
  invoiceId: string | null
}) {
  try {
    const supabase = createAdminClient()
    await supabase.from('sms_log').insert({
      delivery_id: opts.deliveryId,
      invoice_id: opts.invoiceId,
      recipient_phone: opts.to,
      sms_type: opts.type,
      message_body: opts.body,
      status: opts.status,
      provider_message_id: opts.providerMessageId,
      error_message: opts.errorMessage,
      sent_at: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[v0] sms_log insert failed', err)
  }
}

export async function sendSms(input: SendSmsInput): Promise<SendSmsResult> {
  const intendedTo = normalize(input.to)
  if (!intendedTo) {
    return { ok: false, reason: 'Invalid phone number', logged: false }
  }

  const testRecipient = process.env.SMS_TEST_RECIPIENT?.trim()
  const redirect = !!testRecipient && testRecipient !== intendedTo
  const finalTo = redirect ? normalize(testRecipient!) : intendedTo
  const finalBody = redirect
    ? `[TEST -> ${intendedTo}] ${input.body}`
    : input.body

  const client = getClient()
  const sender = getSender()
  console.log('[v0] sms.send', {
    type: input.type,
    to: intendedTo,
    redirected: redirect,
    finalTo,
    hasClient: !!client,
    hasSender: !!sender,
  })

  if (!client || !sender) {
    console.log('[v0] sms.disabled missing TWILIO env — would have sent:', {
      type: input.type,
      to: intendedTo,
      redirectTo: redirect ? finalTo : undefined,
      body: finalBody,
    })
    if (!input.skipLog) {
      await recordSms({
        to: intendedTo,
        body: finalBody,
        type: input.type,
        status: 'sent',
        providerMessageId: `dev-${Date.now()}`,
        errorMessage: null,
        deliveryId: input.deliveryId ?? null,
        invoiceId: input.invoiceId ?? null,
      })
    }
    return { ok: true, sid: 'dev-stub', redirected: redirect }
  }

  try {
    const message = await client.messages.create({
      to: finalTo,
      body: finalBody,
      ...sender,
    })
    if (!input.skipLog) {
      await recordSms({
        to: intendedTo,
        body: finalBody,
        type: input.type,
        status: 'sent',
        providerMessageId: message.sid,
        errorMessage: null,
        deliveryId: input.deliveryId ?? null,
        invoiceId: input.invoiceId ?? null,
      })
    }
    return { ok: true, sid: message.sid, redirected: redirect }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'Twilio error'
    if (!input.skipLog) {
      await recordSms({
        to: intendedTo,
        body: finalBody,
        type: input.type,
        status: 'failed',
        providerMessageId: null,
        errorMessage: reason,
        deliveryId: input.deliveryId ?? null,
        invoiceId: input.invoiceId ?? null,
      })
    }
    return { ok: false, reason, logged: !input.skipLog }
  }
}
