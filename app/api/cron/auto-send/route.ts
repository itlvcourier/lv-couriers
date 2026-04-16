import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getInvoiceSettings,
  sendInvoiceAndRecord,
  scheduleInvoiceEvent,
  type CronInvoiceRow,
} from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runs on the 1st of each month.
 * Moves every DRAFT invoice to SENT and fires the initial email,
 * then schedules reminder_1, reminder_2, overdue_notice, and escalation events.
 *
 * Respects settings.auto_send_invoices: if OFF, this cron is a no-op.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const settings = await getInvoiceSettings()
  if (!settings.auto_send_invoices) {
    return NextResponse.json({ ok: true, skipped: 'auto_send_invoices disabled' })
  }

  const supabase = createAdminClient()

  const { data: drafts, error } = await supabase
    .from('invoices')
    .select(
      `id, invoice_number, business_id, location_id, billing_email, backup_billing_email,
       status, due_date, sent_at, period_start, period_end, total, reminders_paused, email_bounced,
       businesses(name),
       business_locations(name)`,
    )
    .eq('status', 'draft')
    .returns<Array<CronInvoiceRow & { businesses: { name: string } | null; business_locations: { name: string } | null }>>()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const results: Array<{ invoiceId: string; ok: boolean; reason?: string }> = []
  const now = new Date()

  for (const row of drafts || []) {
    if (!row.billing_email || row.email_bounced) {
      results.push({ invoiceId: row.id, ok: false, reason: 'missing or bounced email' })
      continue
    }

    const normalized: CronInvoiceRow = {
      ...row,
      business_name: row.businesses?.name || 'Business',
      location_name: row.business_locations?.name || null,
    }

    const { result } = await sendInvoiceAndRecord(normalized, 'sent')
    if (!result.ok) {
      results.push({ invoiceId: row.id, ok: false, reason: result.reason })
      continue
    }

    // Flip to 'sent' and schedule downstream events
    const due = new Date(row.due_date + 'T00:00:00Z')
    await supabase.from('invoices').update({ status: 'sent', sent_at: now.toISOString() }).eq('id', row.id)

    const r1 = new Date(now)
    r1.setUTCDate(r1.getUTCDate() + settings.invoice_reminder_day_1)
    const overdue = new Date(due)
    overdue.setUTCDate(overdue.getUTCDate() + settings.invoice_overdue_notice_day)
    const escalation = new Date(due)
    escalation.setUTCDate(escalation.getUTCDate() + settings.invoice_escalation_day)

    await Promise.all([
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'reminder_1', scheduled_for: r1 }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'reminder_2', scheduled_for: due }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'overdue_notice', scheduled_for: overdue }),
      scheduleInvoiceEvent({ invoice_id: row.id, event_type: 'escalated', scheduled_for: escalation }),
    ])

    results.push({ invoiceId: row.id, ok: true })
  }

  return NextResponse.json({
    ok: true,
    sent: results.filter((r) => r.ok).length,
    skipped: results.filter((r) => !r.ok).length,
    results,
  })
}
