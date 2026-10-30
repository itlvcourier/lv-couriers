import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { HANDOFF_RULE_LABELS, cleanText, isHandoffRule } from '@/lib/handoff'
import { logConsentEvent, resolveActorName } from '@/lib/consent-server'

const LOCKED_STATUSES = new Set(['delivered', 'cancelled', 'failed_permanent'])

/** Business or admin updates the handoff rule for a delivery. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth
  if (auth.profile.role === 'driver') {
    return NextResponse.json({ error: 'Drivers cannot change delivery instructions' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !isHandoffRule(body.rule)) {
    return NextResponse.json({ error: 'Invalid handoff rule' }, { status: 400 })
  }
  const namedPerson = cleanText(body.namedPerson, 80)
  if (body.rule === 'recipient_or_named' && !namedPerson) {
    return NextResponse.json({ error: 'Enter the name of the person who can receive it' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from('deliveries')
    .select('status')
    .eq('id', id)
    .maybeSingle<{ status: string }>()
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (LOCKED_STATUSES.has(delivery.status)) {
    return NextResponse.json({ error: 'This delivery is already closed' }, { status: 409 })
  }

  const update = {
    handoff_rule: body.rule,
    handoff_require_id: body.requireId === true,
    handoff_named_person: body.rule === 'recipient_or_named' ? namedPerson : null,
    handoff_named_relationship:
      body.rule === 'recipient_or_named' ? cleanText(body.namedRelationship, 60) : null,
    handoff_location_note: cleanText(body.locationNote, 200),
    handoff_set_by: auth.profile.role === 'admin' ? 'admin' : 'business',
    handoff_updated_at: new Date().toISOString(),
  }
  const { error } = await admin.from('deliveries').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actor = await resolveActorName(admin, auth.user.id, auth.profile.role)
  await logConsentEvent(admin, {
    deliveryId: id,
    eventType: 'rule_changed',
    actorRole: auth.profile.role === 'admin' ? 'admin' : 'business',
    actorId: auth.user.id,
    actorName: actor.name,
    summary: `Handoff set to "${HANDOFF_RULE_LABELS[body.rule]}"${update.handoff_require_id ? ' (ID required)' : ''}.`,
    details: update,
  })

  return NextResponse.json({ ok: true })
}
