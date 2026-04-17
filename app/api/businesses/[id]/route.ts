import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * DELETE /api/businesses/:id  — permanently delete a business + its locations
 *   + its rate cards. Refuses if ANY deliveries or invoices exist for the
 *   business. In that case, the admin should Suspend the business instead
 *   (keeps the record + billing history intact).
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Safety: block hard-delete if any deliveries exist.
  const { count: deliveryCount, error: delErr } = await supabase
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id)
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 })
  }
  if ((deliveryCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'Business has delivery history and cannot be permanently deleted. Suspend it instead.',
        deliveryCount,
      },
      { status: 409 },
    )
  }

  // Safety: block hard-delete if any invoices exist.
  const { count: invoiceCount, error: invErr } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true })
    .eq('business_id', id)
  if (invErr) {
    return NextResponse.json({ error: invErr.message }, { status: 500 })
  }
  if ((invoiceCount ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'Business has invoices on file and cannot be permanently deleted. Suspend it instead.',
        invoiceCount,
      },
      { status: 409 },
    )
  }

  // Clean up child tables that reference business_id before deleting the
  // business itself. Order matters because of FK constraints.
  await supabase.from('saved_contacts').delete().eq('business_id', id)
  await supabase.from('rate_cards').delete().eq('business_id', id)
  await supabase.from('business_locations').delete().eq('business_id', id)

  const { error: bizErr } = await supabase
    .from('businesses')
    .delete()
    .eq('id', id)
  if (bizErr) {
    return NextResponse.json({ error: bizErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
