'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { ShieldCheck, MapPin, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { authedJson } from '@/lib/api-client'
import {
  HANDOFF_RULE_LABELS,
  RECEIVED_BY_LABELS,
  isHandoffRule,
  isReceivedByType,
  type ConsentEvent,
  type ConsentRequest,
} from '@/lib/handoff'
import { HandoffRuleFields, validateHandoff, type HandoffValue } from './HandoffRuleFields'

export interface HandoffSnapshot {
  handoffRule?: string | null
  handoffRequireId?: boolean | null
  handoffNamedPerson?: string | null
  handoffNamedRelationship?: string | null
  handoffLocationNote?: string | null
  receivedByType?: string | null
  receivedByName?: string | null
  receivedByRelationship?: string | null
}

export function handoffSnapshotFromRow(row: Record<string, unknown>): HandoffSnapshot {
  const str = (k: string) => (typeof row[k] === 'string' ? (row[k] as string) : null)
  return {
    handoffRule: str('handoff_rule'),
    handoffRequireId: row.handoff_require_id === true,
    handoffNamedPerson: str('handoff_named_person'),
    handoffNamedRelationship: str('handoff_named_relationship'),
    handoffLocationNote: str('handoff_location_note'),
    receivedByType: str('received_by_type'),
    receivedByName: str('received_by_name'),
    receivedByRelationship: str('received_by_relationship'),
  }
}

interface Props {
  deliveryId: string
  status: string
  handoff: HandoffSnapshot
  canEdit: boolean
  onRuleChanged?: (next: HandoffValue) => void
}

const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  business: 'Business',
  driver: 'Driver',
  customer: 'Recipient',
  system: 'System',
}

const EVENT_TONE: Record<string, string> = {
  consent_approved: 'text-[var(--accent-green)]',
  handed_off: 'text-[var(--accent-green)]',
  consent_declined: 'text-destructive',
  consent_send_failed: 'text-destructive',
  consent_expired: 'text-amber-500',
}

const CLOSED = new Set(['delivered', 'cancelled', 'failed_permanent'])

export function ConsentLog({ deliveryId, status, handoff, canEdit, onRuleChanged }: Props) {
  const { data, isLoading, mutate } = useSWR(
    ['consent', deliveryId],
    () => authedJson<{ events: ConsentEvent[]; requests: ConsentRequest[] }>(`/api/deliveries/${deliveryId}/consent`),
    { refreshInterval: CLOSED.has(status) ? 0 : 15_000 },
  )
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const rule = isHandoffRule(handoff.handoffRule) ? handoff.handoffRule : 'door'
  const [draft, setDraft] = useState<HandoffValue>({
    handoffRule: rule,
    handoffRequireId: !!handoff.handoffRequireId,
    handoffNamedPerson: handoff.handoffNamedPerson ?? '',
    handoffNamedRelationship: handoff.handoffNamedRelationship ?? '',
    handoffLocationNote: handoff.handoffLocationNote ?? '',
  })

  const save = async () => {
    const err = validateHandoff(draft)
    if (err) return toast.error(err)
    setSaving(true)
    try {
      await authedJson(`/api/deliveries/${deliveryId}/handoff`, {
        method: 'PATCH',
        body: JSON.stringify({
          rule: draft.handoffRule,
          requireId: draft.handoffRequireId,
          namedPerson: draft.handoffNamedPerson,
          namedRelationship: draft.handoffNamedRelationship,
          locationNote: draft.handoffLocationNote,
        }),
      })
      toast.success('Handoff instructions updated')
      onRuleChanged?.(draft)
      setEditing(false)
      void mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update')
    } finally {
      setSaving(false)
    }
  }

  const receivedType = isReceivedByType(handoff.receivedByType) ? handoff.receivedByType : null
  const events = data?.events ?? []

  return (
    <section aria-labelledby={`consent-${deliveryId}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h3 id={`consent-${deliveryId}`} className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <ShieldCheck className="h-4 w-4" aria-hidden="true" />
          Consent &amp; handoff record
        </h3>
        {canEdit && !CLOSED.has(status) && !editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)} className="h-8 gap-1.5">
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] p-3">
          <HandoffRuleFields value={draft} onChange={setDraft} idPrefix={`edit-${deliveryId}`} />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1 rounded-xl border border-[var(--border-color)] p-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-foreground">{HANDOFF_RULE_LABELS[rule]}</span>
            {handoff.handoffRequireId && <Badge variant="outline">ID check</Badge>}
          </div>
          {rule === 'recipient_or_named' && handoff.handoffNamedPerson && (
            <p className="text-muted-foreground">
              {'Also allowed: '}
              {handoff.handoffNamedPerson}
              {handoff.handoffNamedRelationship ? ` (${handoff.handoffNamedRelationship})` : ''}
            </p>
          )}
          {handoff.handoffLocationNote && <p className="text-muted-foreground">{handoff.handoffLocationNote}</p>}
          {receivedType && (
            <p className="mt-1 text-foreground">
              <span className="text-muted-foreground">{'Received by: '}</span>
              {RECEIVED_BY_LABELS[receivedType]}
              {handoff.receivedByName ? ` — ${handoff.receivedByName}` : ''}
              {handoff.receivedByRelationship ? ` (${handoff.receivedByRelationship})` : ''}
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Spinner />
        </div>
      ) : events.length === 0 ? (
        <p className="text-xs text-muted-foreground">No handoff events recorded yet.</p>
      ) : (
        <ol className="flex flex-col gap-3 border-l border-[var(--border-color)] pl-4">
          {events.map(ev => (
            <li key={ev.id} className="relative flex flex-col gap-0.5">
              <span
                aria-hidden="true"
                className="absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-[var(--bg-card)] bg-muted-foreground"
              />
              <p className={`text-sm leading-relaxed ${EVENT_TONE[ev.eventType] ?? 'text-foreground'}`}>{ev.summary}</p>
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                <span>{format(new Date(ev.createdAt), 'MMM d, h:mm:ss a')}</span>
                <span>
                  {ROLE_LABEL[ev.actorRole] ?? ev.actorRole}
                  {ev.actorName ? ` · ${ev.actorName}` : ''}
                </span>
                {ev.lat != null && ev.lng != null && (
                  <a
                    href={`https://www.google.com/maps?q=${ev.lat},${ev.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-0.5 underline underline-offset-2"
                  >
                    <MapPin className="h-3 w-3" aria-hidden="true" />
                    GPS
                  </a>
                )}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
