import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanText } from '@/lib/handoff'
import {
  expireStaleRequests,
  logConsentEvent,
  mapConsentEvent,
  mapConsentRequest,
  resolveActorName,
} from '@/lib/consent-server'

/** Full consent / handoff record for a delivery (admin, business, assigned driver). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth

  const admin = createAdminClient()
  await expireStaleRequests(admin, id)
  const [events, requests] = await Promise.all([
    admin
      .from('delivery_consent_events')
      .select('*')
      .eq('delivery_id', id)
      .order('created_at', { ascending: true }),
    admin
      .from('delivery_consent_requests')
      .select('*')
      .eq('delivery_id', id)
      .order('created_at', { ascending: false }),
  ])

  return NextResponse.json({
    events: (events.data ?? []).map(mapConsentEvent),
    requests: (requests.data ?? []).map(mapConsentRequest),
  })
}

const DRIVER_EVENT_TYPES = {
  arrived: 'Arrived at the drop-off',
  called_recipient: 'Called the recipient',
  no_answer: 'Recipient did not answer',
  recipient_unavailable: 'Recipient not available',
  in_person_authorization: 'Recipient authorized handoff in person',
  phone_authorization: 'Recipient authorized handoff by phone call',
  note: 'Driver note',
} as const
type DriverEventType = keyof typeof DRIVER_EVENT_TYPES

/** Driver logs something that happened at the door. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'driver' && auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only the driver can log handoff events' }, { status: 403 })
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const type = body?.type as DriverEventType | undefined
  if (!type || !(type in DRIVER_EVENT_TYPES)) {
    return NextResponse.json({ error: 'Invalid event type' }, { status: 400 })
  }

  const note = cleanText(body?.note, 400)
  const receiverName = cleanText(body?.receiverName, 80)
  const relationship = cleanText(body?.relationship, 60)
  if ((type === 'in_person_authorization' || type === 'phone_authorization') && !receiverName) {
    return NextResponse.json({ error: 'Enter who the recipient authorized' }, { status: 400 })
  }
  if (type === 'note' && !note) {
    return NextResponse.json({ error: 'Note is empty' }, { status: 400 })
  }

  const admin = createAdminClient()
  const actor = await resolveActorName(admin, auth.user.id, auth.profile.role)

  let summary: string = DRIVER_EVENT_TYPES[type]
  if (receiverName) summary += ` — give to ${receiverName}${relationship ? ` (${relationship})` : ''}`
  if (note) summary += `. ${note}`

  await logConsentEvent(admin, {
    deliveryId: id,
    eventType: type,
    actorRole: auth.profile.role === 'admin' ? 'admin' : 'driver',
    actorId: auth.user.id,
    actorName: actor.name,
    summary,
    details: { note, receiverName, relationship },
    lat: typeof body?.lat === 'number' ? body.lat : null,
    lng: typeof body?.lng === 'number' ? body.lng : null,
  })

  return NextResponse.json({ ok: true })
}
