/**
 * Server-side helpers for invoice workflows. All functions use the service-role
 * admin client and are safe to call from cron routes and server actions.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import {
  sendInvoiceEmail,
  type EmailResult,
} from '@/lib/email'
import {
  invoiceSentEmail,
  invoiceReminderEmail,
  invoiceOverdueEmail,
  invoiceEscalatedEmail,
} from '@/lib/email-templates'

export type CronInvoiceRow = {
  id: string
  invoice_number: string
  business_id: string
  business_name: string
  location_id: string | null
  location_name: string | null
  billing_email: string | null
  backup_billing_email: string | null
  status: 'draft' | 'sent' | 'paid' | 'overdue' | 'disputed' | 'escalated'
  due_date: string
  sent_at: string | null
  period_start: string
  period_end: string
  total: number
  reminders_paused: boolean
  email_bounced: boolean
}

export type InvoiceSettingsRow = {
  auto_generate_invoices: boolean
  auto_send_invoices: boolean
  invoice_due_days: number
  invoice_reminder_day_1: number
  invoice_overdue_notice_day: number
  invoice_escalation_day: number
  send_reminder_email: boolean
  send_reminder_sms: boolean
}

export async function getInvoiceSettings(): Promise<InvoiceSettingsRow> {
  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('system_settings')
    .select(
      'auto_generate_invoices,auto_send_invoices,invoice_due_days,invoice_reminder_day_1,invoice_overdue_notice_day,invoice_escalation_day,send_reminder_email,send_reminder_sms',
    )
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`settings read failed: ${error.message}`)

  return (
    data || {
      auto_generate_invoices: true,
      auto_send_invoices: false,
      invoice_due_days: 15,
      invoice_reminder_day_1: 7,
      invoice_overdue_notice_day: 7,
      invoice_escalation_day: 14,
      send_reminder_email: true,
      send_reminder_sms: false,
    }
  )
}

/** Log a realized event (not scheduled). */
export async function logInvoiceEvent(params: {
  invoice_id: string
  event_type: string
  email?: string
  phone?: string
  note?: string
  metadata?: Record<string, unknown>
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('invoice_events').insert({
    invoice_id: params.invoice_id,
    event_type: params.event_type,
    occurred_at: new Date().toISOString(),
    email: params.email || null,
    phone: params.phone || null,
    note: params.note || null,
    metadata: params.metadata || {},
  })
  if (error) console.error('[v0] cron logInvoiceEvent failed', error)
}

/** Insert a future scheduled event the cron will pick up later. */
export async function scheduleInvoiceEvent(params: {
  invoice_id: string
  event_type: string
  scheduled_for: Date
  note?: string
}) {
  const supabase = createAdminClient()
  const { error } = await supabase.from('invoice_events').insert({
    invoice_id: params.invoice_id,
    event_type: params.event_type,
    scheduled_for: params.scheduled_for.toISOString(),
    note: params.note || null,
  })
  if (error) console.error('[v0] cron scheduleInvoiceEvent failed', error)
}

/**
 * Send an invoice email and record the outcome. Returns the EmailResult plus a
 * flag indicating whether the invoice should be flagged as bounced.
 */
export async function sendInvoiceAndRecord(
  row: CronInvoiceRow,
  kind: 'sent' | 'reminder_1' | 'reminder_2' | 'overdue_notice' | 'escalated',
): Promise<{ result: EmailResult; event: string }> {
  const data = {
    invoiceNumber: row.invoice_number,
    businessName: row.business_name,
    total: Number(row.total),
    dueDate: row.due_date,
    periodStart: row.period_start,
    periodEnd: row.period_end,
    locationName: row.location_name || row.business_name,
  }

  let tpl: { subject: string; html: string; text: string }
  if (kind === 'sent') tpl = invoiceSentEmail(data)
  else if (kind === 'reminder_1') tpl = invoiceReminderEmail(data, 1)
  else if (kind === 'reminder_2') tpl = invoiceReminderEmail(data, 2)
  else if (kind === 'overdue_notice') tpl = invoiceOverdueEmail(data)
  else tpl = invoiceEscalatedEmail(data)

  const to = row.billing_email || ''
  if (!to) {
    return {
      result: { ok: false, reason: 'missing billing_email', bounced: true },
      event: kind,
    }
  }

  const result = await sendInvoiceEmail({
    to,
    cc: row.backup_billing_email || undefined,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tag: `invoice.${kind}`,
  })

  if (result.ok) {
    await logInvoiceEvent({ invoice_id: row.id, event_type: kind, email: to })
  } else {
    await logInvoiceEvent({
      invoice_id: row.id,
      event_type: 'bounced',
      email: to,
      note: result.reason,
      metadata: { attempted_event: kind, hard_bounce: result.bounced },
    })
    if (result.bounced) {
      await createAdminClient()
        .from('invoices')
        .update({ email_bounced: true })
        .eq('id', row.id)
    }
  }

  return { result, event: kind }
}
