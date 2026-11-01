import { NextRequest, NextResponse } from 'next/server'
import { requireDeliveryParty, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export type TimelineKind = 'status' | 'custody' | 'consent' | 'address' | 'sms' | 'issue' | 'proof'
export type TimelineTone = 'neutral' | 'good' | 'warn' | 'bad'

export interface TimelineEntry {
  id: string
  at: string
  kind: TimelineKind
  tone: TimelineTone
  title: string
  detail?: string | null
  actor?: string | null
  photoUrl?: string | null
}

const STATUS_LABEL: Record<string, string> = {
  posted: 'Order posted',
  claimed: 'Courier assigned',
  en_route_pickup: 'Courier heading to pickup',
  at_pickup: 'Courier arrived at pickup',
  picked_up: 'Package picked up',
  en_route_dropoff: 'Out for delivery',
  delivered: 'Delivered',
  failed_attempt: 'Delivery attempt failed',
  failed_permanent: 'Delivery failed',
  cancelled: 'Order cancelled',
}

function statusTone(s: string): TimelineTone {
  if (s === 'delivered') return 'good'
  if (s === 'failed_attempt') return 'warn'
  if (s === 'failed_permanent' || s === 'cancelled') return 'bad'
  return 'neutral'
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await requireDeliveryParty(req, id)
  if (isAuthError(auth)) return auth

  const db = createAdminClient()
  const [delivery, history, custody, consentReq, consentEv, address, sms, issues] = await Promise.all([
    db.from('deliveries').select('id, proof_photo_url, signature_url, delivered_at, received_by_name, received_by_type, received_by_id_type, received_by_id_last4, pin_verified_at').eq('id', id).maybeSingle(),
    db.from('status_history').select('id, status, notes, created_at').eq('delivery_id', id),
    db.from('custody_events').select('id, event_type, actor_type, from_holder, to_holder, scan_method, notes, created_at').eq('delivery_id', id),
    db.from('delivery_consent_requests').select('id, request_type, proposed_receiver_name, status, reply_body, created_at, responded_at, expires_at').eq('delivery_id', id),
    db.from('delivery_consent_events').select('id, event_type, actor_role, actor_name, summary, created_at').eq('delivery_id', id),
    db.from('address_history').select('id, old_address, new_address, actor_type, source, created_at').eq('delivery_id', id),
    db.from('sms_log').select('id, sms_type, status, sent_at').eq('delivery_id', id),
    db.from('delivery_issues').select('id, issue_type, description, status, resolution, created_at, resolved_at').eq('delivery_id', id),
  ])

  const out: TimelineEntry[] = []

  for (const h of history.data ?? []) {
    out.push({
      id: `s-${h.id}`, at: h.created_at, kind: 'status', tone: statusTone(h.status),
      title: STATUS_LABEL[h.status] ?? h.status, detail: h.notes,
    })
  }
  for (const c of custody.data ?? []) {
    out.push({
      id: `c-${c.id}`, at: c.created_at, kind: 'custody', tone: 'neutral',
      title: `Custody: ${String(c.event_type).replace(/_/g, ' ')}`,
      detail: [c.from_holder && c.to_holder ? `${c.from_holder} to ${c.to_holder}` : null, c.scan_method ? `via ${c.scan_method}` : null, c.notes].filter(Boolean).join(' · ') || null,
      actor: c.actor_type,
    })
  }
  for (const r of consentReq.data ?? []) {
    out.push({
      id: `cr-${r.id}`, at: r.created_at, kind: 'consent', tone: 'warn',
      title: `Recipient asked to approve: ${String(r.request_type).replace(/_/g, ' ')}`,
      detail: r.proposed_receiver_name ? `Proposed receiver: ${r.proposed_receiver_name}` : null,
      actor: 'Courier',
    })
    if (r.responded_at || r.status !== 'pending') {
      const approved = r.status === 'approved'
      out.push({
        id: `crr-${r.id}`, at: r.responded_at ?? r.expires_at ?? r.created_at, kind: 'consent',
        tone: approved ? 'good' : 'bad',
        title: approved ? 'Recipient approved' : r.status === 'expired' ? 'Request expired with no reply' : `Recipient ${r.status}`,
        detail: r.reply_body ? `Reply: "${r.reply_body}"` : null,
        actor: 'Recipient',
      })
    }
  }
  for (const e of consentEv.data ?? []) {
    out.push({
      id: `ce-${e.id}`, at: e.created_at, kind: 'consent', tone: 'neutral',
      title: e.summary ?? String(e.event_type).replace(/_/g, ' '),
      actor: e.actor_name ?? e.actor_role,
    })
  }
  for (const a of address.data ?? []) {
    out.push({
      id: `a-${a.id}`, at: a.created_at, kind: 'address', tone: 'warn',
      title: 'Drop-off address changed',
      detail: `${a.old_address ?? 'Unknown'} → ${a.new_address ?? 'Unknown'}`,
      actor: a.actor_type ?? a.source,
    })
  }
  for (const s of sms.data ?? []) {
    out.push({
      id: `m-${s.id}`, at: s.sent_at, kind: 'sms', tone: s.status === 'failed' ? 'bad' : 'neutral',
      title: `Text message: ${String(s.sms_type).replace(/_/g, ' ')}`,
      detail: s.status === 'failed' ? 'Not delivered' : null,
    })
  }
  for (const i of issues.data ?? []) {
    out.push({
      id: `i-${i.id}`, at: i.created_at, kind: 'issue', tone: 'bad',
      title: `Problem reported: ${String(i.issue_type).replace(/_/g, ' ')}`, detail: i.description,
    })
    if (i.resolved_at) {
      out.push({
        id: `ir-${i.id}`, at: i.resolved_at, kind: 'issue', tone: 'good',
        title: `Case ${i.status}`, detail: i.resolution,
      })
    }
  }
  const d = delivery.data
  if (d?.delivered_at && (d.proof_photo_url || d.signature_url)) {
    out.push({
      id: 'proof', at: d.delivered_at, kind: 'proof', tone: 'good',
      title: d.signature_url && d.proof_photo_url ? 'Photo and signature captured' : d.signature_url ? 'Signature captured' : 'Proof photo captured',
      detail: d.received_by_name ? `Received by ${d.received_by_name}` : null,
      photoUrl: d.proof_photo_url,
    })
  }
  if (d?.delivered_at && d.received_by_id_type) {
    out.push({
      id: 'id-check', at: d.delivered_at, kind: 'proof', tone: 'good',
      title: 'Recipient ID checked',
      detail: `${d.received_by_id_type}${d.received_by_id_last4 ? ` ending ${d.received_by_id_last4}` : ''}`,
    })
  }
  if (d?.pin_verified_at) {
    out.push({ id: 'pin', at: d.pin_verified_at, kind: 'proof', tone: 'good', title: 'Delivery PIN confirmed by recipient' })
  }

  out.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
  return NextResponse.json({ entries: out.filter((e) => e.at) })
}
