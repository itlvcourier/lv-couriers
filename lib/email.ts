/**
 * Email adapter. Uses Resend when RESEND_API_KEY is set; otherwise logs
 * the payload to stdout so local dev/demo runs don't blow up.
 *
 * Returns `{ ok: true, id }` on success, or `{ ok: false, reason, bounced }` when the
 * provider indicates a delivery failure (which the caller should treat as a bounce).
 */

import { Resend } from 'resend'

export type SendInvoiceEmailInput = {
  to: string
  cc?: string | string[]
  replyTo?: string
  subject: string
  html: string
  text: string
  /** Internal tag for logging - e.g. 'invoice.sent', 'invoice.reminder_1' */
  tag: string
}

export type EmailResult =
  | { ok: true; id: string }
  | { ok: false; reason: string; bounced: boolean }

const FROM_ADDRESS = process.env.RESEND_FROM || 'Lv Couriers <billing@lv-couriers.local>'

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

export async function sendInvoiceEmail(input: SendInvoiceEmailInput): Promise<EmailResult> {
  const client = getResend()

  if (!client) {
    console.log('[v0] email.disabled no RESEND_API_KEY — would have sent:', {
      tag: input.tag,
      to: input.to,
      subject: input.subject,
    })
    return { ok: true, id: `dev-${Date.now()}` }
  }

  try {
    const result = await client.emails.send({
      from: FROM_ADDRESS,
      to: input.to,
      cc: input.cc,
      replyTo: input.replyTo,
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: [{ name: 'tag', value: input.tag.replace(/\./g, '_') }],
    })

    if (result.error) {
      const reason = String(result.error.message || 'Resend error')
      // Treat invalid-recipient / bounce-like errors as bounces (not transient)
      const bounced = /invalid|not.*found|bounce|permanent|rejected/i.test(reason)
      return { ok: false, reason, bounced }
    }
    return { ok: true, id: result.data?.id || '' }
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'unknown email error'
    // Network / rate-limit / 5xx errors are transient, not bounces
    return { ok: false, reason, bounced: false }
  }
}
