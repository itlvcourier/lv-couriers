import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * PATCH  /api/drivers/:id  — edit name, email, phone
 *   If email changes we update auth.users.email too (admin API).
 *
 * DELETE /api/drivers/:id  — permanently delete
 *   Refuses if the driver has any deliveries. In that case the caller
 *   should use the existing "Deactivate" action (invite_status='deactivated')
 *   to preserve history.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    email?: string
    phone?: string
  }

  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const phone = body.phone?.trim()

  if (!name && !email && phone === undefined) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Load current driver so we know what actually changed.
  const { data: existing, error: loadErr } = await supabase
    .from('drivers')
    .select('id, email')
    .eq('id', id)
    .single()
  if (loadErr || !existing) {
    return NextResponse.json({ error: 'Driver not found' }, { status: 404 })
  }

  // If email is being changed, push the new email into auth.users first.
  // If that fails we bail before touching the drivers row so they stay in sync.
  if (email && email !== existing.email) {
    const { error: authErr } = await supabase.auth.admin.updateUserById(id, {
      email,
      email_confirm: true,
    })
    if (authErr) {
      const status = /already|duplicate/i.test(authErr.message) ? 409 : 400
      return NextResponse.json(
        { error: `Auth email update failed: ${authErr.message}` },
        { status },
      )
    }
  }

  // Build driver patch with only defined fields.
  const patch: Record<string, string> = {}
  if (name) patch.name = name
  if (email) patch.email = email
  if (phone !== undefined) patch.phone = phone

  const { error: updErr } = await supabase
    .from('drivers')
    .update(patch)
    .eq('id', id)
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = createAdminClient()

  // Safety check: cannot hard-delete a driver with any delivery history.
  // (We only need to know if there's *at least one* row — use head+count.)
  const { count, error: countErr } = await supabase
    .from('deliveries')
    .select('id', { count: 'exact', head: true })
    .eq('driver_id', id)
  if (countErr) {
    return NextResponse.json({ error: countErr.message }, { status: 500 })
  }
  if ((count ?? 0) > 0) {
    return NextResponse.json(
      {
        error:
          'Driver has delivery history and cannot be permanently deleted. Deactivate instead.',
        deliveryCount: count,
      },
      { status: 409 },
    )
  }

  // Null out profile.driver_id first so the FK doesn't block deletion.
  await supabase
    .from('profiles')
    .update({ driver_id: null })
    .eq('driver_id', id)

  // Delete drivers row.
  const { error: delDriverErr } = await supabase
    .from('drivers')
    .delete()
    .eq('id', id)
  if (delDriverErr) {
    return NextResponse.json({ error: delDriverErr.message }, { status: 500 })
  }

  // Delete auth user. If this fails we don't un-delete the driver row — the
  // orphaned auth user can be cleaned up manually, and the important part
  // (the driver appearing in lists) is already done.
  await supabase.auth.admin.deleteUser(id).catch(() => {})

  return NextResponse.json({ ok: true })
}
