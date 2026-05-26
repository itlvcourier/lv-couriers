import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendInvoiceAndRecord,
  scheduleInvoiceEvent,
  getInvoiceSettings,
  type CronInvoiceRow,
} from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Admin-triggered invoice send. Called by the UI when an admin clicks
 * "Send" on a draft invoice. Performs the same work the /api/cron/auto-send
 * cron does for a single invoice: send via Resend, mark sent, and schedule
 * the reminder/overdue/escalation events.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    invoiceId?: string
    backupEmail?: string
  }
  const invoiceId = body.invoiceId
  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoiceId' }, { status: 400 })
  }

  console.log('[v0] invoice-sent API called for invoiceId:', invoiceId)

  const supabase = createAdminClient()

  // Helper to fetch invoice with retry (handles race condition when invoice was just created)
  async function fetchInvoiceWithRetry(maxRetries = 3, delayMs = 500) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      const { data: inv, error } = await supabase
        .from('invoices')
        .select(
          `id, invoice_number, business_id, location_id, billing_email, backup_billing_email,
           status, due_date, sent_at, period_start, period_end, total, reminders_paused, email_bounced,
           businesses(name),
           business_locations(name)`,
        )
        .eq('id', invoiceId)
        .maybeSingle<
          CronInvoiceRow & { businesses: { name: string } | null; business_locations: { name: string } | null }
        >()

      if (inv) {
        return { data: inv, error: null }
      }

      if (attempt < maxRetries) {
        console.log(`[v0] invoice-sent: Invoice not found, retrying (${attempt}/${maxRetries})...`)
        await new Promise(resolve => setTimeout(resolve, delayMs))
      } else {
        return { data: null, error: error || new Error('Invoice not found after retries') }
      }
    }
    return { data: null, error: new Error('Invoice not found') }
  }

  const { data: inv, error } = await fetchInvoiceWithRetry()

  if (error || !inv) {
    const errMsg = error instanceof Error ? error.message : (error as { message?: string })?.message || 'Invoice not found'
    console.log('[v0] invoice-sent: Invoice not found in DB. Error:', errMsg)
    return NextResponse.json({ error: errMsg }, { status: 404 })
  }

  console.log('[v0] invoice-sent: Found invoice', inv.invoice_number, 'billing_email:', inv.billing_email)

  // If an admin explicitly provided a backupEmail (because the original
  // bounced), route the send there and clear the bounced flag for the retry.
  if (body.backupEmail) {
    inv.billing_email = body.backupEmail
    inv.email_bounced = false
  }

  if (!inv.billing_email) {
    return NextResponse.json({ error: 'No billing email set' }, { status: 400 })
  }

  const normalized: CronInvoiceRow = {
    ...inv,
    business_name: inv.businesses?.name || 'Business',
    location_name: inv.business_locations?.name || null,
  }

  const { result } = await sendInvoiceAndRecord(normalized, 'sent')
  console.log('[v0] invoice-sent: sendInvoiceAndRecord result:', result)
  if (!result.ok) {
    return NextResponse.json({ error: result.reason, bounced: result.bounced }, { status: 502 })
  }

  const now = new Date()
  const due = new Date(inv.due_date + 'T00:00:00Z')

  const settings = await getInvoiceSettings()
  const r1 = new Date(now)
  r1.setUTCDate(r1.getUTCDate() + settings.invoice_reminder_day_1)
  const overdue = new Date(due)
  overdue.setUTCDate(overdue.getUTCDate() + settings.invoice_overdue_notice_day)
  const escalation = new Date(due)
  escalation.setUTCDate(escalation.getUTCDate() + settings.invoice_escalation_day)

  await Promise.all([
    supabase
      .from('invoices')
      .update({
        status: 'sent',
        sent_at: now.toISOString(),
        billing_email: inv.billing_email,
        email_bounced: false,
      })
      .eq('id', inv.id),
    scheduleInvoiceEvent({ invoice_id: inv.id, event_type: 'reminder_1', scheduled_for: r1 }),
    scheduleInvoiceEvent({ invoice_id: inv.id, event_type: 'reminder_2', scheduled_for: due }),
    scheduleInvoiceEvent({ invoice_id: inv.id, event_type: 'overdue_notice', scheduled_for: overdue }),
    scheduleInvoiceEvent({ invoice_id: inv.id, event_type: 'escalated', scheduled_for: escalation }),
  ])

  return NextResponse.json({ ok: true, invoiceId: inv.id })
}
