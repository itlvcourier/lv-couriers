import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { setOptOut, sendSms } from '@/lib/twilio'

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
  const from = params.get('From') || ''
  const rawMsg = (params.get('Body') || '').trim().toUpperCase()

  if (!from) {
    return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
  }

  const supabase = createAdminClient()

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
      body: 'You have been unsubscribed from LV Couriers SMS notifications. Reply START to re-subscribe.',
      type: 'opt_out_confirm',
      skipOptOutCheck: true,
      skipLog: false,
    })
  } else if (OPT_IN_KEYWORDS.includes(rawMsg)) {
    await setOptOut(from, false)
    await sendSms({
      to: from,
      body: 'You have re-subscribed to LV Couriers SMS notifications. Reply STOP at any time to unsubscribe.',
      type: 'opt_out_confirm',
      skipOptOutCheck: true,
      skipLog: false,
    })
  }

  // Always return empty TwiML so Twilio doesn't send a generic reply
  return new Response('<Response/>', { headers: { 'Content-Type': 'text/xml' } })
}
