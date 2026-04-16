import { NextResponse, type NextRequest } from 'next/server'
import { verifyCron } from '@/lib/cron-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { logInvoiceEvent } from '@/lib/invoice-db'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Runs once daily, 15 minutes after process-reminders.
 * Flips every SENT invoice whose due_date has passed to status = 'overdue'.
 * (The escalation flip is handled by process-reminders when the scheduled
 * `escalated` event fires — this cron only handles the status transition
 * from sent -> overdue.)
 */
export async function GET(req: NextRequest) {
  const auth = verifyCron(req)
  if (!auth.ok) return NextResponse.json({ error: auth.reason }, { status: auth.status })

  const supabase = createAdminClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('invoices')
    .update({ status: 'overdue' })
    .eq('status', 'sent')
    .lt('due_date', today)
    .select('id, invoice_number, due_date')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  for (const row of data || []) {
    await logInvoiceEvent({
      invoice_id: row.id,
      event_type: 'overdue_notice',
      note: `Auto-marked overdue (was sent, due ${row.due_date})`,
    })
  }

  return NextResponse.json({
    ok: true,
    flipped: (data || []).length,
    invoiceIds: (data || []).map((r) => r.id),
  })
}
