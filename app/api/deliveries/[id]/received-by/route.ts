import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  RECEIVED_BY_LABELS,
  allowedReceiversForRule,
  cleanText,
  isHandoffRule,
  isReceivedByType,
  type ConsentRequestType,
  type ReceivedByType,
} from '@/lib/handoff'
import { logConsentEvent, resolveActorName } from '@/lib/consent-server'

const AUTHORIZATION_EVENTS = ['in_person_authorization', 'phone_authorization']
const NEEDS_NAME = new Set(['named_person', 'other_person', 'reception', 'security'])
/** Approvals older than this (e.g. from a previous attempt) no longer count. */
const APPROVAL_VALID_HOURS = 3
/** For these, the person receiving must be the person the recipient approved. */
const NEEDS_NAME_MATCH = new Set<ReceivedByType>(['other_person', 'named_person'])

/** Which "received by" choice an approved text request actually covers. */
function approvalCovers(requestType: ConsentRequestType, receivedBy: ReceivedByType): boolean {
  switch (requestType) {
    case 'other_person':
    case 'neighbour':
    case 'other':
      return receivedBy === 'other_person' || receivedBy === 'named_person'
    case 'reception':
      return receivedBy === 'reception'
    case 'security':
      return receivedBy === 'security'
    case 'leave_at_door':
      return receivedBy === 'door'
  }
}

function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  return !!a && !!b && norm(a) === norm(b)
}

/**
 * Driver records who physically received the delivery, right before completing.
 * The server re-checks the business's handoff rule so the UI can't be bypassed.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'driver' && auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only the driver can record the receiver' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !isReceivedByType(body.type)) {
    return NextResponse.json({ error: 'Choose who received the delivery' }, { status: 400 })
  }
  const type = body.type
  const name = cleanText(body.name, 80)
  const relationship = cleanText(body.relationship, 60)
  const idType = cleanText(body.idType, 40)
  const idLast4 = typeof body.idLast4 === 'string' ? body.idLast4.replace(/[^A-Za-z0-9]/g, '').slice(-4) : ''

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from('deliveries')
    .select('status, handoff_rule, handoff_require_id, handoff_named_person')
    .eq('id', id)
    .maybeSingle<{
      status: string
      handoff_rule: string | null
      handoff_require_id: boolean | null
      handoff_named_person: string | null
    }>()
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (delivery.status === 'delivered' || delivery.status === 'cancelled') {
    return NextResponse.json({ error: 'Delivery is already closed' }, { status: 409 })
  }

  const rule = isHandoffRule(delivery.handoff_rule) ? delivery.handoff_rule : 'door'
  let approvedVia: string | null = null
  if (!allowedReceiversForRule(rule).includes(type)) {
    const since = new Date(Date.now() - APPROVAL_VALID_HOURS * 3_600_000).toISOString()
    const [{ data: approvals }, { data: authEvents }] = await Promise.all([
      admin
        .from('delivery_consent_requests')
        .select('request_type, proposed_receiver_name')
        .eq('delivery_id', id)
        .eq('status', 'approved')
        .gte('responded_at', since)
        .order('responded_at', { ascending: false }),
      admin
        .from('delivery_consent_events')
        .select('details')
        .eq('delivery_id', id)
        .in('event_type', AUTHORIZATION_EVENTS)
        .gte('created_at', since),
    ])

    const matchingTypes = (approvals ?? []).filter(a =>
      approvalCovers(a.request_type as ConsentRequestType, type),
    )
    const textMatch = matchingTypes.find(a => !NEEDS_NAME_MATCH.has(type) || sameName(a.proposed_receiver_name, name))
    const recordedMatch =
      NEEDS_NAME_MATCH.has(type) &&
      (authEvents ?? []).some(e => sameName((e.details as { receiverName?: string } | null)?.receiverName, name))

    if (textMatch) approvedVia = 'text_approval'
    else if (recordedMatch) approvedVia = 'driver_recorded_authorization'
    else if (matchingTypes.length > 0 && NEEDS_NAME_MATCH.has(type)) {
      const approvedNames = matchingTypes.map(a => a.proposed_receiver_name).filter(Boolean).join(', ')
      return NextResponse.json(
        { error: `The recipient approved ${approvedNames || 'a different person'}. Enter that name, or request a new approval.` },
        { status: 403 },
      )
    } else {
      return NextResponse.json(
        {
          error:
            'This handoff is not allowed by the delivery instructions. Get the recipient\u2019s approval for this exact handoff first, or mark the attempt as failed.',
        },
        { status: 403 },
      )
    }
  }

  if (NEEDS_NAME.has(type) && !name) {
    return NextResponse.json({ error: 'Enter the name of the person who received it' }, { status: 400 })
  }
  const personHandoff = type !== 'door'
  if (delivery.handoff_require_id && !personHandoff) {
    return NextResponse.json(
      { error: 'This order needs an ID check, so it must be handed to a person, not left at the door' },
      { status: 400 },
    )
  }
  if (delivery.handoff_require_id && (!idType || idLast4.length < 4)) {
    return NextResponse.json(
      { error: 'ID check required: choose the ID type and enter the last 4 characters' },
      { status: 400 },
    )
  }

  const update = {
    received_by_type: type,
    received_by_name: type === 'named_person' && !name ? delivery.handoff_named_person : name,
    received_by_relationship: relationship,
    received_by_id_type: personHandoff ? idType : null,
    received_by_id_last4: personHandoff && idLast4 ? idLast4 : null,
  }
  const { error } = await admin.from('deliveries').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const actor = await resolveActorName(admin, auth.user.id, auth.profile.role)
  const who = update.received_by_name ? ` — ${update.received_by_name}${relationship ? ` (${relationship})` : ''}` : ''
  const idNote = update.received_by_id_type ? `. ID checked: ${update.received_by_id_type} ending ${update.received_by_id_last4}` : ''
  await logConsentEvent(admin, {
    deliveryId: id,
    eventType: 'handed_off',
    actorRole: auth.profile.role === 'admin' ? 'admin' : 'driver',
    actorId: auth.user.id,
    actorName: actor.name,
    summary: `Received by: ${RECEIVED_BY_LABELS[type]}${who}${idNote}${
      approvedVia === 'text_approval'
        ? ' (allowed: recipient approved by text)'
        : approvedVia === 'driver_recorded_authorization'
          ? ' (allowed: driver-reported verbal authorization, not confirmed by text)'
          : ''
    }.`,
    details: { ...update, approvedVia },
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
  })

  return NextResponse.json({ ok: true })
}
