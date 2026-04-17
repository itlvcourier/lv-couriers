import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { disputeResolvedEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Email the business after a dispute has been resolved by an admin.
 * Sent to the invoice's billing_email. If not available, falls back to the
 * business's primary email.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { disputeId?: string }
  const disputeId = body.disputeId
  if (!disputeId) {
    return NextResponse.json({ error: 'Missing disputeId' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: dispute, error } = await supabase
    .from('invoice_disputes')
    .select(
      `id, status, reason, resolution_notes, credit_amount, line_item_id,
       invoices(id, invoice_number, billing_email, business_id, businesses(name, email))`,
    )
    .eq('id', disputeId)
    .maybeSingle<{
      id: string
      status: 'open' | 'accepted' | 'rejected'
      reason: string
      resolution_notes: string | null
      credit_amount: number | null
      line_item_id: string | null
      invoices: {
        id: string
        invoice_number: string
        billing_email: string | null
        business_id: string
        businesses: { name: string; email: string | null } | null
      } | null
    }>()

  if (error || !dispute || !dispute.invoices) {
    return NextResponse.json(
      { error: error?.message || 'Dispute not found' },
      { status: 404 },
    )
  }

  if (dispute.status === 'open') {
    return NextResponse.json({ ok: false, reason: 'Dispute not yet resolved' })
  }

  let lineItemDescription = 'Line item'
  if (dispute.line_item_id) {
    const { data: li } = await supabase
      .from('invoice_line_items')
      .select('description')
      .eq('id', dispute.line_item_id)
      .maybeSingle()
    if (li?.description) lineItemDescription = li.description
  }

  const to = dispute.invoices.billing_email || dispute.invoices.businesses?.email || ''
  if (!to) {
    return NextResponse.json({ ok: false, reason: 'No recipient email' })
  }

  const tpl = disputeResolvedEmail({
    businessName: dispute.invoices.businesses?.name || 'Business',
    invoiceNumber: dispute.invoices.invoice_number,
    lineItemDescription,
    action: dispute.status === 'accepted' ? 'accept' : 'reject',
    adminResponse: dispute.resolution_notes || '',
    creditAmount: dispute.credit_amount != null ? Number(dispute.credit_amount) : null,
  })

  const result = await sendEmail({
    to,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tag: 'dispute.resolved',
  })

  return NextResponse.json({ ok: result.ok, to })
}
