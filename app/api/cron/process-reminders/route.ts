import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendInvoiceAndRecord, type CronInvoiceRow } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runs once daily.
 * Picks up every SCHEDULED invoice event where scheduled_for <= now and
 * occurred_at IS NULL, sends the matching email, marks the event occurred,
 * and for `escalated` events flips the invoice status to 'escalated'.
 *
 * Skips invoices that are paid / disputed / escalated / reminders_paused.
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const supabase = createAdminClient()
  const now = new Date()

  const { data: due, error } = await supabase
    .from('invoice_events')
    .select('id, invoice_id, event_type, scheduled_for')
    .is('occurred_at', null)
    .not('scheduled_for', 'is', null)
    .lte('scheduled_for', now.toISOString())
    .order('scheduled_for', { ascending: true })
    .limit(500)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let processed = 0
  let skipped = 0
  let failed = 0

  for (const ev of due || []) {
    // Load the invoice + joined data we need for templates
    const { data: inv, error: invErr } = await supabase
      .from('invoices')
      .select(
        `id, invoice_number, business_id, location_id, billing_email, backup_billing_email,
         status, due_date, sent_at, period_start, period_end, total, reminders_paused, email_bounced,
         businesses(name),
         business_locations(name)`,
      )
      .eq('id', ev.invoice_id)
      .maybeSingle<
        CronInvoiceRow & { businesses: { name: string } | null; business_locations: { name: string } | null }
      >()

    if (invErr || !inv) {
      failed++
      continue
    }

    // Skip terminal / paused states
    const terminal = ['paid', 'disputed', 'escalated']
    if (terminal.includes(inv.status) || inv.reminders_paused || inv.email_bounced) {
      await supabase
        .from('invoice_events')
        .update({
          occurred_at: now.toISOString(),
          scheduled_for: null,
          note: `Skipped: status=${inv.status}${inv.reminders_paused ? ' paused' : ''}${inv.email_bounced ? ' bounced' : ''}`,
        })
        .eq('id', ev.id)
      skipped++
      continue
    }

    const normalized: CronInvoiceRow = {
      ...inv,
      business_name: inv.businesses?.name || 'Business',
      location_name: inv.business_locations?.name || null,
    }

    const kind = ev.event_type as 'reminder_1' | 'reminder_2' | 'overdue_notice' | 'escalated'

    // For `escalated` event: flip status, still send final notice
    if (kind === 'escalated') {
      await supabase.from('invoices').update({ status: 'escalated' }).eq('id', inv.id)
    }

    const { result } = await sendInvoiceAndRecord(normalized, kind)

    // Mark the scheduled row as processed regardless of send success — failure was logged separately
    await supabase
      .from('invoice_events')
      .update({
        occurred_at: now.toISOString(),
        scheduled_for: null,
        note: result.ok ? null : `Send failed: ${result.reason}`,
      })
      .eq('id', ev.id)

    if (result.ok) processed++
    else failed++
  }

  return NextResponse.json({ ok: true, processed, skipped, failed, total: (due || []).length })
}
