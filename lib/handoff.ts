export const HANDOFF_RULES = [
  'recipient_only',
  'recipient_or_named',
  'reception',
  'security',
  'door',
  'call_on_arrival',
] as const
export type HandoffRule = (typeof HANDOFF_RULES)[number]

export const HANDOFF_RULE_LABELS: Record<HandoffRule, string> = {
  recipient_only: 'Hand to recipient only',
  recipient_or_named: 'Recipient or named person',
  reception: 'Leave with reception / concierge',
  security: 'Leave with security',
  door: 'Leave at door',
  call_on_arrival: 'Call recipient on arrival',
}

export const HANDOFF_RULE_HINTS: Record<HandoffRule, string> = {
  recipient_only: 'Never give to anyone else. Driver must hand it to the recipient.',
  recipient_or_named: 'Recipient, or the person named below.',
  reception: 'Front desk or concierge can sign for it.',
  security: 'Building security can sign for it.',
  door: 'Driver leaves it at the door and takes a photo.',
  call_on_arrival: 'Driver calls before handing off.',
}

/** Short uppercase tag for printed labels. */
export const HANDOFF_LABEL_TAGS: Record<HandoffRule, string> = {
  recipient_only: 'RECIPIENT ONLY',
  recipient_or_named: 'RECIPIENT OR NAMED',
  reception: 'RECEPTION OK',
  security: 'SECURITY OK',
  door: 'DOOR OK',
  call_on_arrival: 'CALL ON ARRIVAL',
}

export const RECEIVED_BY_TYPES = [
  'recipient',
  'named_person',
  'other_person',
  'reception',
  'security',
  'door',
] as const
export type ReceivedByType = (typeof RECEIVED_BY_TYPES)[number]

export const RECEIVED_BY_LABELS: Record<ReceivedByType, string> = {
  recipient: 'Recipient',
  named_person: 'Named person',
  other_person: 'Someone else (approved)',
  reception: 'Reception / concierge',
  security: 'Security',
  door: 'Left at door',
}

export const ID_TYPES = ["Driver's licence", 'Health card', 'Passport', 'Photo ID card', 'Other'] as const

export const CONSENT_REQUEST_TYPES = [
  'other_person',
  'neighbour',
  'reception',
  'security',
  'leave_at_door',
  'other',
] as const
export type ConsentRequestType = (typeof CONSENT_REQUEST_TYPES)[number]

export const CONSENT_REQUEST_LABELS: Record<ConsentRequestType, string> = {
  other_person: 'Give to someone else',
  neighbour: 'Give to a neighbour',
  reception: 'Leave with reception',
  security: 'Leave with security',
  leave_at_door: 'Leave at the door',
  other: 'Other',
}

export const CONSENT_REQUEST_TTL_MINUTES = 5

export function isHandoffRule(v: unknown): v is HandoffRule {
  return typeof v === 'string' && (HANDOFF_RULES as readonly string[]).includes(v)
}
export function isReceivedByType(v: unknown): v is ReceivedByType {
  return typeof v === 'string' && (RECEIVED_BY_TYPES as readonly string[]).includes(v)
}
export function isConsentRequestType(v: unknown): v is ConsentRequestType {
  return typeof v === 'string' && (CONSENT_REQUEST_TYPES as readonly string[]).includes(v)
}

/**
 * Which "received by" options a driver may pick without extra approval, given
 * the rule on the delivery. Anything else needs an approved consent request
 * (or an in-person authorization) first.
 */
export function allowedReceiversForRule(rule: HandoffRule): ReceivedByType[] {
  switch (rule) {
    case 'recipient_only':
      return ['recipient']
    case 'recipient_or_named':
      return ['recipient', 'named_person']
    case 'reception':
      return ['recipient', 'reception']
    case 'security':
      return ['recipient', 'security']
    case 'door':
      return ['recipient', 'door', 'reception', 'security']
    case 'call_on_arrival':
      return ['recipient']
  }
}

export function cleanText(v: unknown, max = 120): string | null {
  if (typeof v !== 'string') return null
  const t = v.replace(/[\u0000-\u001f]/g, ' ').trim()
  return t ? t.slice(0, max) : null
}

export function normalizePhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return cleaned
  if (cleaned.length === 10) return `+1${cleaned}`
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`
  return cleaned
}

export interface ConsentEvent {
  id: string
  deliveryId: string
  eventType: string
  actorRole: string
  actorName: string | null
  summary: string
  details: Record<string, unknown>
  lat: number | null
  lng: number | null
  createdAt: string
}

export interface ConsentRequest {
  id: string
  deliveryId: string
  requestType: ConsentRequestType
  proposedReceiverName: string | null
  proposedRelationship: string | null
  status: 'pending' | 'approved' | 'declined' | 'expired' | 'cancelled'
  replyBody: string | null
  expiresAt: string
  respondedAt: string | null
  createdAt: string
}
