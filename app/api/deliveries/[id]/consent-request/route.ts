import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendSms } from '@/lib/twilio'
import {
  CONSENT_REQUEST_LABELS,
  CONSENT_REQUEST_TTL_MINUTES,
  cleanText,
  isConsentRequestType,
  normalizePhone,
} from '@/lib/handoff'
import {
  expireStaleRequests,
  logConsentEvent,
  mapConsentRequest,
  resolveActorName,
} from '@/lib/consent-server'

// Only once the driver has the package; asking before pickup makes no sense.
const ACTIVE_STATUSES = new Set(['picked_up', 'en_route_dropoff', 'failed_attempt'])
const MAX_REQUESTS_PER_WINDOW = 3
const REQUEST_WINDOW_MINUTES = 30
const MIN_SECONDS_BETWEEN_REQUESTS = 60

async function requireDriverOnDelivery(req: NextRequest, id: string) {
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'driver' && auth.profile.role !== 'admin') {
    return NextResponse.json({ error: 'Only the assigned driver can request approval' }, { status: 403 })
  }
  return auth
}

/** Latest approval request (driver polls this while waiting). */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth

  const admin = createAdminClient()
  await expireStaleRequests(admin, id)
  const { data } = await admin
    .from('delivery_consent_requests')
    .select('*')
    .eq('delivery_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return NextResponse.json({ request: data ? mapConsentRequest(data) : null })
}

/** Driver texts the recipient asking to approve an alternative handoff. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDriverOnDelivery(req, id)
  if (auth instanceof NextResponse) return auth

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body || !isConsentRequestType(body.requestType)) {
    return NextResponse.json({ error: 'Choose what you want to do' }, { status: 400 })
  }
  const requestType = body.requestType
  const receiverName = cleanText(body.receiverName, 80)
  const relationship = cleanText(body.relationship, 60)
  const note = cleanText(body.note, 160)
  if ((requestType === 'other_person' || requestType === 'neighbour') && !receiverName) {
    return NextResponse.json({ error: 'Enter the name of the person receiving it' }, { status: 400 })
  }
  if (requestType === 'other' && !note) {
    return NextResponse.json({ error: 'Describe what you are asking for' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from('deliveries')
    .select('id, status, recipient_name, recipient_phone, driver_id, handoff_require_id, businesses(name)')
    .eq('id', id)
    .maybeSingle<{
      id: string
      status: string
      handoff_require_id: boolean | null
      recipient_name: string | null
      recipient_phone: string | null
      driver_id: string | null
      businesses: { name: string | null } | null
    }>()
  if (!delivery) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!ACTIVE_STATUSES.has(delivery.status)) {
    return NextResponse.json({ error: 'You can only ask for approval after picking up the package' }, { status: 409 })
  }
  if (delivery.handoff_require_id && requestType === 'leave_at_door') {
    return NextResponse.json(
      { error: 'This order needs an ID check, so it cannot be left at the door even with approval' },
      { status: 422 },
    )
  }

  const windowStart = new Date(Date.now() - REQUEST_WINDOW_MINUTES * 60_000).toISOString()
  const { data: recent } = await admin
    .from('delivery_consent_requests')
    .select('created_at')
    .eq('delivery_id', id)
    .gte('created_at', windowStart)
    .order('created_at', { ascending: false })
  if (recent && recent.length > 0) {
    const secondsSinceLast = (Date.now() - new Date(recent[0].created_at as string).getTime()) / 1000
    if (secondsSinceLast < MIN_SECONDS_BETWEEN_REQUESTS) {
      return NextResponse.json(
        { error: `Please wait ${Math.ceil(MIN_SECONDS_BETWEEN_REQUESTS - secondsSinceLast)}s before sending another text` },
        { status: 429 },
      )
    }
    if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
      return NextResponse.json(
        { error: 'Too many approval texts sent. Call the business, or mark the attempt as failed.' },
        { status: 429 },
      )
    }
  }
  if (!delivery.recipient_phone) {
    return NextResponse.json(
      { error: 'No recipient phone on file. Call the business for approval and log it as a note.' },
      { status: 422 },
    )
  }

  await expireStaleRequests(admin, id)
  const nowIso = new Date().toISOString()
  // Only one open request per delivery so a YES can't approve a stale ask.
  await admin
    .from('delivery_consent_requests')
    .update({ status: 'cancelled', responded_at: nowIso })
    .eq('delivery_id', id)
    .eq('status', 'pending')

  const actor = await resolveActorName(admin, auth.user.id, auth.profile.role)
  const driverName = actor.name?.split(' ')[0] || 'Your driver'
  const businessName = delivery.businesses?.name || 'your pharmacy'
  const ask =
    requestType === 'other_person' || requestType === 'neighbour'
      ? `give it to ${receiverName}${relationship ? ` (${relationship})` : ''}`
      : requestType === 'reception'
        ? 'leave it with reception / concierge'
        : requestType === 'security'
          ? 'leave it with building security'
          : requestType === 'leave_at_door'
            ? 'leave it at your door'
            : note!
  // A per-request code lets a recipient with several pending approvals answer the right one.
  const replyCode = String(crypto.getRandomValues(new Uint32Array(1))[0] % 9000 + 1000)
  const messageBody =
    `DOMS By Atria360: ${driverName} is at your address with your delivery from ${businessName} and could not reach you. ` +
    `May they ${ask}?${delivery.handoff_require_id ? ' The person receiving it must show photo ID.' : ''} ` +
    `Reply YES ${replyCode} to approve or NO ${replyCode} to decline. Expires in ${CONSENT_REQUEST_TTL_MINUTES} min.`

  const phone = normalizePhone(delivery.recipient_phone)
  const expiresAt = new Date(Date.now() + CONSENT_REQUEST_TTL_MINUTES * 60_000).toISOString()
  const { data: created, error } = await admin
    .from('delivery_consent_requests')
    .insert({
      delivery_id: id,
      driver_id: actor.driverId ?? delivery.driver_id,
      request_type: requestType,
      proposed_receiver_name: receiverName,
      proposed_relationship: relationship,
      note,
      recipient_phone: phone,
      message_body: messageBody,
      reply_code: replyCode,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('*')
    .single()
  if (error || !created) {
    return NextResponse.json({ error: error?.message || 'Could not create request' }, { status: 500 })
  }

  const sms = await sendSms({
    to: phone,
    body: messageBody,
    type: 'consent_request',
    deliveryId: id,
    driverId: actor.driverId ?? delivery.driver_id,
    // The recipient must be able to answer even if they opted out of updates.
    skipOptOutCheck: true,
    dedupeWindowMinutes: 0,
  })

  if (!sms.ok) {
    await admin
      .from('delivery_consent_requests')
      .update({ status: 'cancelled', responded_at: new Date().toISOString() })
      .eq('id', created.id)
    await logConsentEvent(admin, {
      deliveryId: id,
      eventType: 'consent_send_failed',
      actorRole: 'system',
      summary: `Approval text could not be sent: ${sms.reason}`,
      details: { requestId: created.id },
    })
    return NextResponse.json({ error: `Text could not be sent: ${sms.reason}` }, { status: 502 })
  }

  await logConsentEvent(admin, {
    deliveryId: id,
    eventType: 'consent_requested',
    actorRole: auth.profile.role === 'admin' ? 'admin' : 'driver',
    actorId: auth.user.id,
    actorName: actor.name,
    summary: `Approval requested by text: ${CONSENT_REQUEST_LABELS[requestType]}${receiverName ? ` — ${receiverName}` : ''}.`,
    details: { requestId: created.id, message: messageBody },
    lat: typeof body.lat === 'number' ? body.lat : null,
    lng: typeof body.lng === 'number' ? body.lng : null,
  })

  return NextResponse.json({ request: mapConsentRequest(created) })
}

/** Driver cancels the open request. */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDriverOnDelivery(req, id)
  if (auth instanceof NextResponse) return auth

  const admin = createAdminClient()
  const { data } = await admin
    .from('delivery_consent_requests')
    .update({ status: 'cancelled', responded_at: new Date().toISOString() })
    .eq('delivery_id', id)
    .eq('status', 'pending')
    .select('id')
  if (data && data.length > 0) {
    const actor = await resolveActorName(admin, auth.user.id, auth.profile.role)
    await logConsentEvent(admin, {
      deliveryId: id,
      eventType: 'consent_cancelled',
      actorRole: 'driver',
      actorId: auth.user.id,
      actorName: actor.name,
      summary: 'Driver cancelled the approval request.',
    })
  }
  return NextResponse.json({ ok: true })
}
