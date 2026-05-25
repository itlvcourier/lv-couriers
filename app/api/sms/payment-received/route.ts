import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'

/**
 * Notify business when their payment has been received and invoice marked paid.
 * Triggered: after markInvoicePaid() action in AdminInvoices.
 * Recipients: billing contact phone for the location
 * Setting gate: sms_notify_payment_received
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
    .select('sms_notify_payment_received')
    .limit(1)
    .maybeSingle()
  if (settings?.sms_notify_payment_received === false) {
    return NextResponse.json({ ok: false, reason: 'Feature disabled in settings' })
  }

  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('id, invoice_number, total, amount_received, paid_date, recipient_phone, businesses(name)')
    .eq('id', invoiceId)
    .maybeSingle<{
      id: string
      invoice_number: string
      total: number
      amount_received: number | null
      paid_date: string | null
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
  const amount = `$${Number(invoice.amount_received ?? invoice.total).toFixed(2)}`
  const paidDate = invoice.paid_date
    ? new Date(invoice.paid_date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'today'

  const result = await sendSms({
    to: invoice.recipient_phone,
    body:
      `Payment received for Invoice #${invoice.invoice_number} (${businessName}). ` +
      `Amount: ${amount} on ${paidDate}. ` +
      `Thank you! — LV Couriers`,
    type: 'payment_received',
    invoiceId,
  })

  return NextResponse.json({ ok: result.ok, reason: result.ok ? undefined : result.reason })
}
