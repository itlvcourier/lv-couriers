import 'server-only'
import { createHmac, createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'

export const WEBHOOK_EVENTS = [
  'delivery.created',
  'delivery.claimed',
  'delivery.picked_up',
  'delivery.out_for_delivery',
  'delivery.delivered',
  'delivery.failed',
  'delivery.cancelled',
] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export function eventForStatus(status: string): WebhookEvent | null {
  switch (status) {
    case 'posted': return 'delivery.created'
    case 'claimed': return 'delivery.claimed'
    case 'picked_up': return 'delivery.picked_up'
    case 'en_route_dropoff': return 'delivery.out_for_delivery'
    case 'delivered': return 'delivery.delivered'
    case 'failed_attempt':
    case 'failed_permanent': return 'delivery.failed'
    case 'cancelled': return 'delivery.cancelled'
    default: return null
  }
}

export const PUBLIC_DELIVERY_COLUMNS =
  'id, tracking_code, status, recipient_name, recipient_phone, dropoff_address, pickup_address, recipient_note, is_rush, posted_at, claimed_at, picked_up_at, delivered_at, cancelled_at, eta_at, proof_photo_url, signature_url, received_by_name'

export function hashApiKey(key: string) {
  return createHash('sha256').update(key).digest('hex')
}

export function generateApiKey() {
  const raw = `doms_live_${randomBytes(24).toString('base64url')}`
  return { raw, prefix: raw.slice(0, 14), hash: hashApiKey(raw) }
}

export function generateWebhookSecret() {
  return `whsec_${randomBytes(24).toString('base64url')}`
}

export function signPayload(secret: string, timestamp: string, body: string) {
  return createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')
}

/** SSRF guard: only public https endpoints may receive webhooks. */
export function isAllowedWebhookUrl(raw: string) {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return false
    const h = u.hostname.toLowerCase()
    if (h === 'localhost' || h.endsWith('.local') || h.endsWith('.internal')) return false
    if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h)) return false
    if (h.startsWith('[') || h === '::1') return false
    return true
  } catch {
    return false
  }
}

async function postOne(endpoint: { id: string; url: string; secret: string }, event: string, payload: unknown, deliveryId: string | null) {
  const db = createAdminClient()
  const body = JSON.stringify({ event, created_at: new Date().toISOString(), data: payload })
  const ts = Math.floor(Date.now() / 1000).toString()
  let statusCode: number | null = null
  let error: string | null = null
  try {
    const res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-doms-event': event,
        'x-doms-timestamp': ts,
        'x-doms-signature': `sha256=${signPayload(endpoint.secret, ts, body)}`,
      },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
    })
    statusCode = res.status
    if (!res.ok) error = `HTTP ${res.status}`
  } catch (e) {
    error = e instanceof Error ? e.message : 'Request failed'
  }
  await db.from('webhook_deliveries').insert({ endpoint_id: endpoint.id, event, delivery_id: deliveryId, status_code: statusCode, error })
  return { statusCode, error }
}

export async function dispatchDeliveryEvent(deliveryId: string) {
  const db = createAdminClient()
  const { data: delivery } = await db
    .from('deliveries')
    .select(`business_id, ${PUBLIC_DELIVERY_COLUMNS}`)
    .eq('id', deliveryId)
    .maybeSingle<Record<string, unknown> & { business_id: string | null; status: string }>()
  if (!delivery?.business_id) return { sent: 0 }
  const event = eventForStatus(delivery.status)
  if (!event) return { sent: 0 }

  const { data: endpoints } = await db
    .from('webhook_endpoints')
    .select('id, url, secret, events')
    .eq('business_id', delivery.business_id)
    .eq('active', true)
  const targets = (endpoints ?? []).filter((e) => !e.events?.length || e.events.includes(event))
  if (!targets.length) return { sent: 0 }

  const { business_id: _omit, ...payload } = delivery
  void _omit
  await Promise.all(targets.map((t) => postOne(t, event, payload, deliveryId)))
  return { sent: targets.length }
}

export async function sendTestWebhook(endpoint: { id: string; url: string; secret: string }) {
  return postOne(endpoint, 'ping', { message: 'Test event from DOMS' }, null)
}
