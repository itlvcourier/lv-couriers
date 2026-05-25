import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Notify business when their invoice has been generated and sent.
 * Triggered: after invoice is sent (email/portal) from AdminInvoices.
 * Recipients: billing contact phone for the location
 * Setting gate: sms_notify_invoice_ready
 */
export async function POST(req: Request) {
  let body: { invoiceId?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const invoiceId = body.invoiceId
  if (!invoiceId) return NextResponse.json({ error: 'invoiceId required' }, { status: 400 })

  const supabase = createAdminClient()

  // Check setting gate
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_notify_invoice_ready')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_invoice_ready === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, due_date, status, billing_email, recipient_phone, businesses(name)')
    .eq('id', invoiceId)
    .maybeSingle<{
      id: string
      invoice_number: string
      total: number
      due_date: string | null
      status: string
      billing_email: string
      recipient_phone: string | null
      businesses: { name: string } | null
    }>()

  if (error || !invoice) {
    return NextResponse.json({ error: error?.message || 'Invoice not found' }, { status: 404 })
  }
  if (!invoice.recipient_phone) {
    return NextResponse.json({ ok: false, reason: 'No SMS phone on file for this invoice' })
  }

  const businessName = invoice.businesses?.name || 'your business'
  const total = `$${Number(invoice.total).toFixed(2)}`
  const dueDate = invoice.due_date
    ? new Date(invoice.due_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'see invoice'

  const result = await sendSms({
    to: invoice.recipient_phone,
    body:
      `Invoice #${invoice.invoice_number} for ${businessName} is ready. ` +
      `Total: ${total}, due ${dueDate}. ` +
      `Log in to view and pay. — LV Couriers`,
    type: 'invoice_ready',
    invoiceId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}
