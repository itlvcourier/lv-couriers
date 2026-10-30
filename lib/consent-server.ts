import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ConsentEvent, ConsentRequest } from '@/lib/handoff'

type Admin = ReturnType<typeof createAdminClient>

export interface ConsentEventInput {
  deliveryId: string
  eventType: string
  actorRole: 'admin' | 'business' | 'driver' | 'customer' | 'system'
  actorId?: string | null
  actorName?: string | null
  summary: string
  details?: Record<string, unknown>
  lat?: number | null
  lng?: number | null
}

export async function logConsentEvent(admin: Admin, input: ConsentEventInput): Promise<void> {
  const { error } = await admin.from('delivery_consent_events').insert({
    delivery_id: input.deliveryId,
    event_type: input.eventType,
    actor_role: input.actorRole,
    actor_id: input.actorId ?? null,
    actor_name: input.actorName ?? null,
    summary: input.summary.slice(0, 500),
    details: input.details ?? {},
    lat: typeof input.lat === 'number' && Number.isFinite(input.lat) ? input.lat : null,
    lng: typeof input.lng === 'number' && Number.isFinite(input.lng) ? input.lng : null,
  })
  if (error) console.error('[consent] failed to log event', error.message)
}

/** Resolve a human-friendly actor name for the signed-in user. */
export async function resolveActorName(
  admin: Admin,
  userId: string,
  role: string,
): Promise<{ name: string | null; driverId: string | null }> {
  if (role === 'driver') {
    const { data } = await admin
      .from('drivers')
      .select('id, name')
      .eq('user_id', userId)
      .maybeSingle<{ id: string; name: string | null }>()
    return { name: data?.name ?? null, driverId: data?.id ?? null }
  }
  const { data } = await admin
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .maybeSingle<{ full_name?: string | null; email?: string | null }>()
  return { name: data?.full_name || data?.email || null, driverId: null }
}

/** Mark pending requests past their expiry as expired. Returns nothing. */
export async function expireStaleRequests(admin: Admin, deliveryId?: string): Promise<void> {
  let q = admin
    .from('delivery_consent_requests')
    .update({ status: 'expired', responded_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lt('expires_at', new Date().toISOString())
  if (deliveryId) q = q.eq('delivery_id', deliveryId)
  const { data } = await q.select('id, delivery_id')
  for (const row of (data as { id: string; delivery_id: string }[] | null) ?? []) {
    await logConsentEvent(admin, {
      deliveryId: row.delivery_id,
      eventType: 'consent_expired',
      actorRole: 'system',
      summary: 'Approval request expired with no reply from the recipient.',
      details: { requestId: row.id },
    })
  }
}

export function mapConsentEvent(r: Record<string, unknown>): ConsentEvent {
  return {
    id: r.id as string,
    deliveryId: r.delivery_id as string,
    eventType: r.event_type as string,
    actorRole: r.actor_role as string,
    actorName: (r.actor_name as string | null) ?? null,
    summary: r.summary as string,
    details: (r.details as Record<string, unknown>) ?? {},
    lat: r.lat == null ? null : Number(r.lat),
    lng: r.lng == null ? null : Number(r.lng),
    createdAt: r.created_at as string,
  }
}

export function mapConsentRequest(r: Record<string, unknown>): ConsentRequest {
  return {
    id: r.id as string,
    deliveryId: r.delivery_id as string,
    requestType: r.request_type as ConsentRequest['requestType'],
    proposedReceiverName: (r.proposed_receiver_name as string | null) ?? null,
    proposedRelationship: (r.proposed_relationship as string | null) ?? null,
    status: r.status as ConsentRequest['status'],
    replyBody: (r.reply_body as string | null) ?? null,
    expiresAt: r.expires_at as string,
    respondedAt: (r.responded_at as string | null) ?? null,
    createdAt: r.created_at as string,
  }
}
