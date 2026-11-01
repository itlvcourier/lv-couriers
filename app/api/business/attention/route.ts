import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import { runRecurringSweep } from '@/lib/recurring-runner'

export type AttentionKind =
  | 'failed_attempt'
  | 'consent_pending'
  | 'consent_declined'
  | 'address_changed'
  | 'running_late'
  | 'unclaimed'
  | 'issue_open'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: 'warn' | 'bad'
  deliveryId: string
  trackingCode: string | null
  recipient: string | null
  address: string | null
  title: string
  detail: string
  at: string
  expiresAt?: string | null
}

const ACTIVE = ['posted', 'claimed', 'en_route_pickup', 'at_pickup', 'picked_up', 'en_route_dropoff', 'failed_attempt']

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  const businessId = auth.profile.business_id
  if (auth.profile.role !== 'business' || !businessId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Hobby plan only allows daily crons, so active portals also nudge the
  // recurring scheduler (throttled, and idempotent per schedule run).
  void runRecurringSweep({ throttleMs: 60_000 }).catch(() => {})

  const db = createAdminClient()
  const { data: biz } = await db
    .from('businesses')
    .select('intown_timeout_mins')
    .eq('id', businessId)
    .maybeSingle<{ intown_timeout_mins: number | null }>()
  const unclaimedMins = biz?.intown_timeout_mins ?? 30

  const { data: active } = await db
    .from('deliveries')
    .select('id, status, tracking_code, recipient_name, dropoff_address, posted_at, eta_at, retry_count, address_change_pending, updated_at')
    .eq('business_id', businessId)
    .in('status', ACTIVE)
    .limit(500)

  const deliveries = active ?? []
  const byId = new Map(deliveries.map((d) => [d.id, d]))
  const items: AttentionItem[] = []
  const now = Date.now()

  const base = (d: (typeof deliveries)[number]) => ({
    deliveryId: d.id,
    trackingCode: d.tracking_code,
    recipient: d.recipient_name,
    address: d.dropoff_address,
  })

  for (const d of deliveries) {
    if (d.status === 'failed_attempt') {
      items.push({
        id: `fa-${d.id}`, kind: 'failed_attempt', severity: 'bad', ...base(d),
        title: `Attempt ${Math.max(1, d.retry_count ?? 1)} failed`,
        detail: 'The courier could not complete the drop-off. Choose to reschedule, fix the address or cancel.',
        at: d.updated_at,
      })
    }
    if (d.address_change_pending) {
      items.push({
        id: `ad-${d.id}`, kind: 'address_changed', severity: 'warn', ...base(d),
        title: 'Address change waiting for review',
        detail: 'The courier proposed a corrected drop-off address.',
        at: d.updated_at,
      })
    }
    if (d.eta_at && new Date(d.eta_at).getTime() < now && d.status !== 'failed_attempt') {
      const late = Math.round((now - new Date(d.eta_at).getTime()) / 60000)
      items.push({
        id: `lt-${d.id}`, kind: 'running_late', severity: late > 30 ? 'bad' : 'warn', ...base(d),
        title: `Running ${late} min late`, detail: 'Expected arrival time has passed.', at: d.eta_at,
      })
    }
    if (d.status === 'posted' && d.posted_at && now - new Date(d.posted_at).getTime() > unclaimedMins * 60000) {
      const mins = Math.round((now - new Date(d.posted_at).getTime()) / 60000)
      items.push({
        id: `uc-${d.id}`, kind: 'unclaimed', severity: 'warn', ...base(d),
        title: `No courier yet after ${mins} min`, detail: 'Dispatch has been alerted. You can keep waiting or cancel.',
        at: d.posted_at,
      })
    }
  }

  const ids = deliveries.map((d) => d.id)
  if (ids.length) {
    const since = new Date(now - 24 * 3600 * 1000).toISOString()
    const { data: consents } = await db
      .from('delivery_consent_requests')
      .select('id, delivery_id, request_type, status, created_at, expires_at, responded_at')
      .in('delivery_id', ids)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
    const seen = new Set<string>()
    for (const c of consents ?? []) {
      if (seen.has(c.delivery_id)) continue
      seen.add(c.delivery_id)
      const d = byId.get(c.delivery_id)
      if (!d) continue
      const what = String(c.request_type).replace(/_/g, ' ')
      if (c.status === 'pending') {
        items.push({
          id: `cp-${c.id}`, kind: 'consent_pending', severity: 'warn', ...base(d),
          title: 'Waiting on recipient approval', detail: `Courier asked to ${what}.`,
          at: c.created_at, expiresAt: c.expires_at,
        })
      } else if (c.status === 'declined' || c.status === 'expired') {
        items.push({
          id: `cd-${c.id}`, kind: 'consent_declined', severity: 'bad', ...base(d),
          title: c.status === 'expired' ? 'Recipient did not reply' : 'Recipient declined',
          detail: `Request to ${what} was ${c.status}. Decide how the courier should proceed.`,
          at: c.responded_at ?? c.expires_at ?? c.created_at,
        })
      }
    }
  }

  const { data: issues } = await db
    .from('delivery_issues')
    .select('id, delivery_id, issue_type, status, created_at, deliveries(tracking_code, recipient_name, dropoff_address)')
    .eq('business_id', businessId)
    .in('status', ['open', 'investigating'])
    .order('created_at', { ascending: false })
    .limit(50)
  for (const i of issues ?? []) {
    const d = (Array.isArray(i.deliveries) ? i.deliveries[0] : i.deliveries) as
      | { tracking_code: string | null; recipient_name: string | null; dropoff_address: string | null }
      | null
    items.push({
      id: `is-${i.id}`, kind: 'issue_open', severity: 'warn', deliveryId: i.delivery_id,
      trackingCode: d?.tracking_code ?? null, recipient: d?.recipient_name ?? null, address: d?.dropoff_address ?? null,
      title: `Case ${i.status}: ${String(i.issue_type).replace(/_/g, ' ')}`,
      detail: 'Our team is reviewing this report.', at: i.created_at,
    })
  }

  items.sort((a, b) => (a.severity === b.severity ? (a.at < b.at ? 1 : -1) : a.severity === 'bad' ? -1 : 1))
  return NextResponse.json({ items })
}
