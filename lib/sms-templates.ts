/**
 * Catalog of every customizable SMS. Safe to import from client and server:
 * it only holds default text and metadata. Overrides live in public.sms_templates
 * and are applied server-side by lib/sms-templates-server.ts.
 *
 * Placeholders use {variable} syntax. Variables marked `required` must stay in
 * the text because the message stops working without them (e.g. a reply code).
 */

export type SmsTemplateGroup = 'delivery' | 'exceptions' | 'billing' | 'account'
export type SmsAudience = 'Recipient' | 'Business' | 'Driver' | 'Any'

export type SmsTemplateVar = {
  name: string
  description: string
  example: string
  required?: boolean
}

export type SmsTemplateDef = {
  key: string
  label: string
  group: SmsTemplateGroup
  audience: SmsAudience
  trigger: string
  defaultBody: string
  vars: SmsTemplateVar[]
}

export const SMS_TEMPLATE_GROUPS: Record<SmsTemplateGroup, string> = {
  delivery: 'Delivery updates',
  exceptions: 'Failed, cancelled & approvals',
  billing: 'Billing',
  account: 'Account & opt-out',
}

const V = {
  rush: { name: 'rush', description: '"[RUSH] " on rush jobs, otherwise empty', example: '[RUSH] ' },
  business: { name: 'business_name', description: 'Business name', example: 'Main St Pharmacy' },
  recipient: { name: 'recipient_name', description: 'Recipient name', example: 'Jane Doe' },
  greeting: { name: 'greeting', description: '"Hi Jane" or "Hi" when no name', example: 'Hi Jane Doe' },
  driver: { name: 'driver_name', description: 'Driver name', example: 'Alex' },
  pickupArea: { name: 'pickup_area', description: 'Pickup area', example: 'Downtown' },
  dropoffArea: { name: 'dropoff_area', description: 'Dropoff area', example: 'Westside' },
  pickupAddress: { name: 'pickup_address', description: 'Pickup address', example: '12 King St' },
  dropoffAddress: { name: 'dropoff_address', description: 'Dropoff address', example: '88 Queen Ave' },
  tracking: { name: 'tracking_url', description: 'Live tracking link', example: 'https://atria360.ca/track/abc123' },
} satisfies Record<string, SmsTemplateVar>

export const SMS_TEMPLATES: SmsTemplateDef[] = [
  {
    key: 'order_confirmed.business',
    label: 'Order received',
    group: 'delivery',
    audience: 'Business',
    trigger: 'A new delivery is posted',
    defaultBody:
      "{rush}Order received!\nRoute: {pickup_area} → {dropoff_area}\nRecipient: {recipient_name}\nWe're finding a driver now.\nTrack: {tracking_url}",
    vars: [V.rush, V.pickupArea, V.dropoffArea, V.recipient, V.tracking],
  },
  {
    key: 'order_confirmed.recipient',
    label: 'Delivery scheduled',
    group: 'delivery',
    audience: 'Recipient',
    trigger: 'A new delivery is posted',
    defaultBody:
      'Hi {recipient_name}, {business_name} has scheduled a delivery for you. Track your package: {tracking_url}\n\n— DOMS By Atria360',
    vars: [V.recipient, V.business, V.tracking],
  },
  {
    key: 'job_alert.driver',
    label: 'New job alert',
    group: 'delivery',
    audience: 'Driver',
    trigger: 'A new job is available to on-duty drivers',
    defaultBody: '{rush}New job from {business_name}: {pickup_area} → {dropoff_area}. Open the driver app to claim.',
    vars: [V.rush, V.business, V.pickupArea, V.dropoffArea],
  },
  {
    key: 'driver_assigned.driver',
    label: 'Job assigned',
    group: 'delivery',
    audience: 'Driver',
    trigger: 'A driver claims or is assigned a job',
    defaultBody:
      '{rush}Job assigned from {business_name}.\nPickup: {pickup_address}\nDropoff: {dropoff_address}\nRecipient: {recipient_contact}\nTrack: {tracking_url}',
    vars: [
      V.rush,
      V.business,
      V.pickupAddress,
      V.dropoffAddress,
      { name: 'recipient_contact', description: 'Recipient name and phone', example: 'Jane Doe (+1 555 123 4567)' },
      V.tracking,
    ],
  },
  {
    key: 'driver_assigned.business',
    label: 'Driver assigned',
    group: 'delivery',
    audience: 'Business',
    trigger: 'A driver claims or is assigned a job',
    defaultBody:
      'Driver {driver_name} has been assigned to your delivery.\nRoute: {pickup_area} → {dropoff_area}\nRecipient: {recipient_name}\nTrack live: {tracking_url}',
    vars: [V.driver, V.pickupArea, V.dropoffArea, V.recipient, V.tracking],
  },
  {
    key: 'driver_assigned.recipient',
    label: 'Driver assigned',
    group: 'delivery',
    audience: 'Recipient',
    trigger: 'A driver claims or is assigned a job',
    defaultBody:
      '{greeting}, your delivery from {business_name} has been assigned to driver {driver_name}.\nTrack it live: {tracking_url}\nReply STOP to opt out.',
    vars: [V.greeting, V.business, V.driver, V.tracking],
  },
  {
    key: 'en_route_pickup.business',
    label: 'Driver heading to pickup',
    group: 'delivery',
    audience: 'Business',
    trigger: 'Driver starts heading to the pickup',
    defaultBody:
      '{driver_name} is on the way to pick up your package at {pickup_address}. Track: {tracking_url} — DOMS By Atria360',
    vars: [V.driver, V.pickupAddress, V.tracking],
  },
  {
    key: 'picked_up.business',
    label: 'Package picked up',
    group: 'delivery',
    audience: 'Business',
    trigger: 'Driver picks up the package',
    defaultBody:
      'Package picked up by {driver_name}. Now heading to {recipient_name} at {dropoff_address}. Track: {tracking_url} — DOMS By Atria360',
    vars: [V.driver, V.recipient, V.dropoffAddress, V.tracking],
  },
  {
    key: 'pickup_ready.recipient',
    label: 'Out for delivery',
    group: 'delivery',
    audience: 'Recipient',
    trigger: 'Driver heads to the dropoff',
    defaultBody:
      "Hi {recipient_name}, your package from {business_name} is on its way. We'll be at {dropoff_address} shortly. Track live: {tracking_url}",
    vars: [V.recipient, V.business, V.dropoffAddress, V.tracking],
  },
  {
    key: 'pickup_ready.business',
    label: 'Out for delivery',
    group: 'delivery',
    audience: 'Business',
    trigger: 'Driver heads to the dropoff',
    defaultBody:
      'Driver is en route to {recipient_name} ({business_name}). Address: {dropoff_address}. Live tracking: {tracking_url}',
    vars: [V.recipient, V.business, V.dropoffAddress, V.tracking],
  },
  {
    key: 'delivered.recipient',
    label: 'Delivered',
    group: 'delivery',
    audience: 'Recipient',
    trigger: 'Delivery is completed',
    defaultBody:
      '{greeting}, your package from {business_name} has been delivered. View proof: {tracking_url}\n\n— DOMS By Atria360',
    vars: [V.greeting, V.business, V.tracking],
  },
  {
    key: 'delivered.business',
    label: 'Delivered',
    group: 'delivery',
    audience: 'Business',
    trigger: 'Delivery is completed',
    defaultBody:
      'Delivery to {recipient_name} completed. View proof of delivery (photo + signature): {tracking_url}\n\n— DOMS By Atria360',
    vars: [V.recipient, V.tracking],
  },
  {
    key: 'feedback_request.recipient',
    label: 'Feedback request',
    group: 'delivery',
    audience: 'Recipient',
    trigger: 'After delivery (scheduled review request)',
    defaultBody:
      '{greeting}, how was your delivery from {business_name}? Share your feedback here: {feedback_url} (link expires in 7 days)\nReply STOP to unsubscribe. — DOMS By Atria360',
    vars: [
      V.greeting,
      V.business,
      { name: 'feedback_url', description: 'Feedback form link', example: 'https://atria360.ca/feedback/xyz', required: true },
    ],
  },
  {
    key: 'failed_attempt.recipient_retry',
    label: 'Delivery attempt failed (will retry)',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Delivery attempt fails with attempts remaining',
    defaultBody:
      '{greeting}, we attempted delivery from {business_name} but were unable to complete it. {attempts_left_label} remaining. Track your delivery: {tracking_url} — DOMS By Atria360',
    vars: [
      V.greeting,
      V.business,
      { name: 'attempts_left_label', description: 'e.g. "2 attempts"', example: '2 attempts' },
      V.tracking,
    ],
  },
  {
    key: 'failed_attempt.recipient_final',
    label: 'Delivery failed (no retries left)',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Final delivery attempt fails',
    defaultBody:
      '{greeting}, we were unable to complete your delivery from {business_name} after {retries_label}. Please contact us to arrange redelivery. Track: {tracking_url} — DOMS By Atria360',
    vars: [V.greeting, V.business, { name: 'retries_label', description: 'e.g. "3 attempts"', example: '3 attempts' }, V.tracking],
  },
  {
    key: 'failed_attempt.business_retry',
    label: 'Delivery attempt failed (will retry)',
    group: 'exceptions',
    audience: 'Business',
    trigger: 'Delivery attempt fails with attempts remaining',
    defaultBody:
      'Delivery to {recipient_name} failed (attempt {retries}/{max_retries}). Driver will retry. Track: {tracking_url} — DOMS By Atria360',
    vars: [
      V.recipient,
      { name: 'retries', description: 'Attempts so far', example: '1' },
      { name: 'max_retries', description: 'Maximum attempts', example: '3' },
      V.tracking,
    ],
  },
  {
    key: 'failed_attempt.business_final',
    label: 'Delivery failed (no retries left)',
    group: 'exceptions',
    audience: 'Business',
    trigger: 'Final delivery attempt fails',
    defaultBody:
      'Delivery to {recipient_name} permanently failed after {retries} attempts. Admin review required. Track: {tracking_url} — DOMS By Atria360',
    vars: [V.recipient, { name: 'retries', description: 'Attempts so far', example: '3' }, V.tracking],
  },
  {
    key: 'cancelled.recipient',
    label: 'Delivery cancelled',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Delivery is cancelled',
    defaultBody:
      '{greeting}, your delivery from {business_name} has been cancelled. If this is unexpected, please contact {business_name} directly. — DOMS By Atria360',
    vars: [V.greeting, V.business],
  },
  {
    key: 'cancelled.business',
    label: 'Delivery cancelled',
    group: 'exceptions',
    audience: 'Business',
    trigger: 'Delivery is cancelled',
    defaultBody:
      'Your delivery to {recipient_name} has been cancelled. Contact DOMS By Atria360 if you have questions. — DOMS By Atria360',
    vars: [V.recipient],
  },
  {
    key: 'cancelled.driver',
    label: 'Job cancelled',
    group: 'exceptions',
    audience: 'Driver',
    trigger: 'An assigned delivery is cancelled',
    defaultBody:
      '{driver_name}, the delivery you were assigned has been cancelled. Please check the app for your updated job list. — DOMS By Atria360',
    vars: [V.driver],
  },
  {
    key: 'reassigned.new_driver',
    label: 'Job reassigned to you',
    group: 'exceptions',
    audience: 'Driver',
    trigger: 'Admin reassigns a delivery',
    defaultBody:
      "Hi {driver_name}, you've been assigned a delivery for {business_name}. Pickup: {pickup_address}. Dropoff: {dropoff_address} ({recipient_name}). Track: {tracking_url} — DOMS By Atria360",
    vars: [V.driver, V.business, V.pickupAddress, V.dropoffAddress, V.recipient, V.tracking],
  },
  {
    key: 'reassigned.old_driver',
    label: 'Job reassigned away',
    group: 'exceptions',
    audience: 'Driver',
    trigger: 'Admin reassigns a delivery',
    defaultBody:
      'Hi {driver_name}, the delivery to {recipient_name} has been reassigned to another driver. Check the app for your current jobs. — DOMS By Atria360',
    vars: [V.driver, V.recipient],
  },
  {
    key: 'reassigned.business',
    label: 'Driver changed',
    group: 'exceptions',
    audience: 'Business',
    trigger: 'Admin reassigns a delivery',
    defaultBody:
      'Driver update: {driver_name} is now handling the delivery to {recipient_name}. Track: {tracking_url} — DOMS By Atria360',
    vars: [V.driver, V.recipient, V.tracking],
  },
  {
    key: 'consent_request.recipient',
    label: 'Handoff approval request',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Driver asks permission to leave the package',
    defaultBody:
      'DOMS By Atria360: {driver_name} is at your address with your delivery from {business_name} and could not reach you. May they {ask}?{id_notice} Reply YES {reply_code} to approve or NO {reply_code} to decline. Expires in {expires_minutes} min.',
    vars: [
      V.driver,
      V.business,
      { name: 'ask', description: 'What the driver is asking', example: 'leave it at your door' },
      { name: 'id_notice', description: 'Photo ID sentence when required, otherwise empty', example: ' The person receiving it must show photo ID.' },
      { name: 'reply_code', description: '4-digit reply code', example: '4821', required: true },
      { name: 'expires_minutes', description: 'Minutes until the request expires', example: '15' },
    ],
  },
  {
    key: 'consent_reply.approved',
    label: 'Approval confirmed',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Recipient replies YES',
    defaultBody: 'DOMS By Atria360: Thanks, your approval was recorded and sent to your driver.',
    vars: [],
  },
  {
    key: 'consent_reply.declined',
    label: 'Decline confirmed',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Recipient replies NO',
    defaultBody: 'DOMS By Atria360: Got it, your driver will not leave the delivery. They will follow up with you.',
    vars: [],
  },
  {
    key: 'consent_reply.unknown_code',
    label: 'Unrecognized reply code',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Reply code does not match a pending request',
    defaultBody:
      "DOMS By Atria360: We couldn't match code {code}. Reply YES or NO followed by the 4-digit code from the delivery text.",
    vars: [{ name: 'code', description: 'Code the recipient sent', example: '1234' }],
  },
  {
    key: 'consent_reply.multiple_pending',
    label: 'Several approvals waiting',
    group: 'exceptions',
    audience: 'Recipient',
    trigger: 'Reply without a code while several requests are open',
    defaultBody:
      "DOMS By Atria360: You have {count} delivery approvals waiting. Reply YES or NO with the code from the text you're answering (codes: {codes}).",
    vars: [
      { name: 'count', description: 'Number of open requests', example: '2' },
      { name: 'codes', description: 'Open reply codes', example: '4821, 1937' },
    ],
  },
  {
    key: 'invoice_ready.business',
    label: 'Invoice ready',
    group: 'billing',
    audience: 'Business',
    trigger: 'An invoice is issued',
    defaultBody:
      'Invoice #{invoice_number} for {business_name} is ready. Total: {total}, due {due_date}. Log in to view and pay. — DOMS By Atria360',
    vars: [
      { name: 'invoice_number', description: 'Invoice number', example: 'INV-202610-ab12cd34' },
      V.business,
      { name: 'total', description: 'Invoice total', example: '$245.00' },
      { name: 'due_date', description: 'Due date', example: 'Nov 15, 2026' },
    ],
  },
  {
    key: 'payment_received.business',
    label: 'Payment received',
    group: 'billing',
    audience: 'Business',
    trigger: 'An invoice is marked paid',
    defaultBody:
      'Payment received for Invoice #{invoice_number} ({business_name}). Amount: {amount} on {paid_date}. Thank you! — DOMS By Atria360',
    vars: [
      { name: 'invoice_number', description: 'Invoice number', example: 'INV-202610-ab12cd34' },
      V.business,
      { name: 'amount', description: 'Amount received', example: '$245.00' },
      { name: 'paid_date', description: 'Payment date', example: 'Nov 3, 2026' },
    ],
  },
  {
    key: 'weekly_summary.business',
    label: 'Weekly summary',
    group: 'billing',
    audience: 'Business',
    trigger: 'Weekly scheduled summary',
    defaultBody: '{business_name} weekly summary ({week_label}): {count_label} completed. Log in for details. — DOMS By Atria360',
    vars: [
      V.business,
      { name: 'week_label', description: 'Date range', example: 'Oct 25 – Nov 1' },
      { name: 'count_label', description: 'e.g. "12 deliveries"', example: '12 deliveries' },
    ],
  },
  {
    key: 'driver_invite.driver',
    label: 'Driver invite',
    group: 'account',
    audience: 'Driver',
    trigger: 'Admin invites a new driver',
    defaultBody:
      'Welcome to DOMS By Atria360, {name}. Sign in at {login_url} with email {email} and temp password: {temp_password}. Please change it on first sign-in.',
    vars: [
      { name: 'name', description: 'Driver name', example: 'Alex' },
      { name: 'login_url', description: 'Sign-in link', example: 'https://atria360.ca/login', required: true },
      { name: 'email', description: 'Login email', example: 'alex@example.com', required: true },
      { name: 'temp_password', description: 'Temporary password', example: 'Xy7-pq92', required: true },
    ],
  },
  {
    key: 'opt_out.confirm',
    label: 'Unsubscribed (STOP)',
    group: 'account',
    audience: 'Any',
    trigger: 'Someone replies STOP',
    defaultBody: 'You have been unsubscribed from DOMS By Atria360 SMS notifications. Reply START to re-subscribe.',
    vars: [],
  },
  {
    key: 'opt_in.confirm',
    label: 'Re-subscribed (START)',
    group: 'account',
    audience: 'Any',
    trigger: 'Someone replies START',
    defaultBody: 'You have re-subscribed to DOMS By Atria360 SMS notifications. Reply STOP at any time to unsubscribe.',
    vars: [],
  },
]

export type SmsTemplateKey = (typeof SMS_TEMPLATES)[number]['key']

export const SMS_TEMPLATE_MAP: Record<string, SmsTemplateDef> = Object.fromEntries(
  SMS_TEMPLATES.map((t) => [t.key, t]),
)

export const SMS_TEMPLATE_MAX_LENGTH = 1600

const PLACEHOLDER = /\{([a-z_]+)\}/g

export function renderSmsTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(PLACEHOLDER, (match, name: string) => {
    const value = vars[name]
    return value === undefined || value === null ? match : String(value)
  })
}

export function findPlaceholders(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(PLACEHOLDER), (m) => m[1])))
}

/** Returns a user-facing error, or null when the body is valid for this template. */
export function validateSmsTemplate(def: SmsTemplateDef, body: string): string | null {
  if (!body.trim()) return 'Message cannot be empty.'
  if (body.length > SMS_TEMPLATE_MAX_LENGTH) return `Message must be ${SMS_TEMPLATE_MAX_LENGTH} characters or fewer.`
  const known = new Set(def.vars.map((v) => v.name))
  const unknown = findPlaceholders(body).filter((p) => !known.has(p))
  if (unknown.length) return `Unknown variable${unknown.length > 1 ? 's' : ''}: ${unknown.map((u) => `{${u}}`).join(', ')}`
  const missing = def.vars.filter((v) => v.required && !body.includes(`{${v.name}}`))
  if (missing.length) return `Required variable missing: ${missing.map((m) => `{${m.name}}`).join(', ')}`
  return null
}

export function exampleVars(def: SmsTemplateDef): Record<string, string> {
  return Object.fromEntries(def.vars.map((v) => [v.name, v.example]))
}

/** SMS segments (GSM-7 = 160/153 chars, Unicode = 70/67). Rough guide for cost. */
export function countSmsSegments(text: string): { segments: number; unicode: boolean } {
  // Non-ASCII characters such as → or — force the whole message into Unicode encoding.
  // eslint-disable-next-line no-control-regex
  const unicode = /[^\x00-\x7F]/.test(text)
  const single = unicode ? 70 : 160
  const multi = unicode ? 67 : 153
  const len = text.length
  return { segments: len <= single ? 1 : Math.ceil(len / multi), unicode }
}
