import { NextResponse } from 'next/server'
import twilio from 'twilio'
import { createAdminClient } from '@/lib/supabase/admin'
import { setOptOut, sendSms } from '@/lib/twilio'
import { renderSms } from '@/lib/sms-templates-server'
import { logConsentEvent } from '@/lib/consent-server'
import { CONSENT_REQUEST_LABELS, normalizePhone, type ConsentRequestType } from '@/lib/handoff'

/**
 * Twilio webhook endpoint — receives inbound SMS replies.
 * Twilio sends a POST with application/x-www-form-urlencoded fields.
 * 
 * Handles:
 *   STOP / STOPALL / UNSUBSCRIBE / CANCEL / END / QUIT → opt-out + confirmation
 *   START / UNSTOP / YES                               → opt back in
 * 
 * Returns TwiML (text/xml) so Twilio suppresses its default response.
 * Set this URL in your Twilio number's Messaging Webhook.
 */
export async function POST(req: Request) {
  let body: string
  try {
    body = await req.text()
  } catch {
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  // Parse x-www-form-urlencoded
  const params = new URLSearchParams(body)

  // Reject requests that weren't signed by Twilio, so nobody can opt numbers
  // in or out (or trigger outbound SMS) by posting to this URL.
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const signature = req.headers.get('x-twilio-signature') || ''
  if (!authToken || !signature) {
    return new Response('Forbidden', { status: 403 })
  }
  const forwardedProto = req.headers.get('x-forwarded-proto')
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const url = new URL(req.url)
  const publicUrl = forwardedHost
    ? `${forwardedProto || 'https'}://${forwardedHost}${url.pathname}${url.search}`
    : req.url
  if (!twilio.validateRequest(authToken, signature, publicUrl, Object.fromEntries(params))) {
    return new Response('Forbidden', { status: 403 })
  }

  const from = params.get('From') || ''
  const rawMsg = (params.get('Body') || '').trim().toUpperCase()

  if (!from) {
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  const supabase = createAdminClient()

  // Handoff approval replies take priority over opt-in keywords (YES).
  const consentReply = parseConsentReply(params.get('Body') || '')
  if (consentReply) {
    const handled = await handleConsentReply(supabase, from, consentReply, params.get('Body') || '')
    if (handled) {
      return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
    }
  }

  // Check if opt-out management is enabled
  const { data: settings } = await supabase
    .from('system_settings')
    .select('sms_opt_out_management')
    .limit(1)
    .maybeSingle()

  if (settings?.sms_opt_out_management === false) {
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  const OPT_OUT_KEYWORDS = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']
  const OPT_IN_KEYWORDS = ['START', 'UNSTOP', 'YES']

  if (OPT_OUT_KEYWORDS.includes(rawMsg)) {
    await setOptOut(from, true)
    // Send confirmation (skip opt-out check on the confirmation itself)
    await sendSms({
      to: from,
      body: await renderSms('opt_out.confirm', {}),
      type: 'opt_out_confirm',
      skipOptOutCheck: true,
      skipLog: false,
    })
  } else if (OPT_IN_KEYWORDS.includes(rawMsg)) {
    await setOptOut(from, false)
    await sendSms({
      to: from,
      body: await renderSms('opt_in.confirm', {}),
      type: 'opt_out_confirm',
      skipOptOutCheck: true,
      skipLog: false,
    })
  }

  // Always return empty TwiML so Twilio doesn't send a generic reply
  return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
}

type ConsentReply = { decision: 'approved' | 'declined'; code: string | null }

function parseConsentReply(msg: string): ConsentReply | null {
  const normalized = msg.trim().toUpperCase()
  const code = normalized.match(/\b(\d{4})\b/)?.[1] ?? null
  const firstWord = normalized.match(/^[^A-Z]*(YES|Y|APPROVE|APPROVED|OK|OKAY|NO|N|DECLINE|DECLINED|DENY)\b/)?.[1]
  if (firstWord && ['YES', 'Y', 'APPROVE', 'APPROVED', 'OK', 'OKAY'].includes(firstWord)) return { decision: 'approved', code }
  if (firstWord && ['NO', 'N', 'DECLINE', 'DECLINED', 'DENY'].includes(firstWord)) return { decision: 'declined', code }
  return null
}

type PendingConsent = {
  id: string
  delivery_id: string
  proposed_receiver_name: string | null
  proposed_relationship: string | null
  request_type: ConsentRequestType
  reply_code: string | null
}

/**
 * Resolve a pending handoff approval for this phone. A bare YES/NO is only
 * accepted when exactly one request is waiting; otherwise the reply must
 * include the 4-digit code from the text. Returns true when the reply was consumed.
 */
async function handleConsentReply(
  supabase: ReturnType<typeof createAdminClient>,
  from: string,
  reply: ConsentReply,
  rawBody: string,
): Promise<boolean> {
  const decision = reply.decision
  const phone = normalizePhone(from)
  const now = new Date().toISOString()
  const selectPending = () => supabase
    .from('delivery_consent_requests')
    .select('id, delivery_id, proposed_receiver_name, proposed_relationship, request_type, reply_code')
    .eq('status', 'pending')
    .gt('expires_at', now)
    .order('created_at', { ascending: false })
    .limit(10)

  let { data: pending } = await selectPending().eq('recipient_phone', phone).returns<PendingConsent[]>()
  // SMS providers can format the same Canadian number differently (+1, 1, or local).
  // Retry by the last ten digits so a valid reply is not silently ignored.
  if (!pending?.length) {
    const lastTen = phone.replace(/\D/g, '').slice(-10)
    if (lastTen.length === 10) {
      pending = (await selectPending().ilike('recipient_phone', `%${lastTen}`).returns<PendingConsent[]>()).data
    }
  }
  if (!pending || pending.length === 0) return false

  let request: PendingConsent | undefined
  if (reply.code) {
    request = pending.find((p) => p.reply_code === reply.code)
    if (!request) {
      await sendSms({
        to: phone,
        body: await renderSms('consent_reply.unknown_code', { code: reply.code }),
        type: 'consent_result',
        skipOptOutCheck: true,
        dedupeWindowMinutes: 0,
      })
      return true
    }
  } else if (pending.length === 1) {
    request = pending[0]
  } else {
    const codes = pending.map((p) => p.reply_code).filter(Boolean).join(', ')
    await sendSms({
      to: phone,
      body: await renderSms('consent_reply.multiple_pending', { count: pending.length, codes }),
      type: 'consent_result',
      skipOptOutCheck: true,
      dedupeWindowMinutes: 0,
    })
    return true
  }

  if (!request) return true

  // Guard against a double reply racing: only flip if still pending.
  const { data: updated } = await supabase
    .from('delivery_consent_requests')
    .update({ status: decision, reply_body: rawBody.slice(0, 300), responded_at: now })
    .eq('id', request.id)
    .eq('status', 'pending')
    .select('id')
  if (!updated || updated.length === 0) return true

  const who = request.proposed_receiver_name
    ? ` to ${request.proposed_receiver_name}${request.proposed_relationship ? ` (${request.proposed_relationship})` : ''}`
    : ''
  await logConsentEvent(supabase, {
    deliveryId: request.delivery_id,
    eventType: decision === 'approved' ? 'consent_approved' : 'consent_declined',
    actorRole: 'customer',
    actorName: phone,
    summary: `Recipient ${decision === 'approved' ? 'APPROVED' : 'DECLINED'} by text: ${CONSENT_REQUEST_LABELS[request.request_type]}${who}. Reply: "${rawBody.trim().slice(0, 120)}"`,
    details: { requestId: request.id, reply: rawBody.slice(0, 300), from: phone },
  })

  await sendSms({
    to: phone,
    body: await renderSms(decision === 'approved' ? 'consent_reply.approved' : 'consent_reply.declined', {}),
    type: 'consent_result',
    deliveryId: request.delivery_id,
    skipOptOutCheck: true,
    dedupeWindowMinutes: 0,
  })
  return true
}
