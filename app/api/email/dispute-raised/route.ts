import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { disputeRaisedEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 20

/**
 * Notify admin(s) that a new dispute has been raised.
 * Called by the business client after raiseDispute() persists the row.
 *
 * Admin recipient resolution order:
 *   1. ADMIN_NOTIFICATION_EMAIL env var (comma-separated allowed)
 *   2. All admin profiles' emails
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { disputeId?: string }
  const disputeId = body.disputeId
  if (!disputeId) {
    return NextResponse.json({ error: 'Missing disputeId' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load the dispute + joined invoice/business. Line-item is fetched
  // separately to avoid depending on the PostgREST FK-name for
  // invoice_disputes.line_item_id.
  const { data: dispute, error } = await supabase
    .from('invoice_disputes')
    .select(
      `id, reason, line_item_id,
       invoices(id, invoice_number, business_id, businesses(name))`,
    )
    .eq('id', disputeId)
    .maybeSingle<{
      id: string
      reason: string
      line_item_id: string | null
      invoices: {
        id: string
        invoice_number: string
        business_id: string
        businesses: { name: string } | null
      } | null
    }>()

  if (error || !dispute || !dispute.invoices) {
    return NextResponse.json(
      { error: error?.message || 'Dispute not found' },
      { status: 404 },
    )
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

  const recipients = await resolveAdminRecipients(supabase)
  if (recipients.length === 0) {
    return NextResponse.json({ ok: false, reason: 'No admin recipients configured' })
  }

  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${req.headers.get('host')}`
  const adminUrl = `${origin.replace(/\/$/, '')}/admin?tab=invoices&invoice=${dispute.invoices.id}`

  const tpl = disputeRaisedEmail({
    businessName: dispute.invoices.businesses?.name || 'A business',
    invoiceNumber: dispute.invoices.invoice_number,
    lineItemDescription,
    claim: dispute.reason,
    adminUrl,
  })

  const result = await sendEmail({
    to: recipients,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tag: 'dispute.raised',
  })

  return NextResponse.json({ ok: result.ok, sent: recipients.length })
}

async function resolveAdminRecipients(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<string[]> {
  const env = process.env.ADMIN_NOTIFICATION_EMAIL?.trim()
  if (env) return env.split(',').map(s => s.trim()).filter(Boolean)

  const { data } = await supabase.from('profiles').select('email').eq('role', 'admin')
  return (data || []).map(r => r.email).filter((e): e is string => !!e)
}
