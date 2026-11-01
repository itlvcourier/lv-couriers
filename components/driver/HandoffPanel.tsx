'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { ShieldAlert, ShieldCheck, Phone, MessageSquare, UserCheck, DoorOpen, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { authedJson, getPosition } from '@/lib/api-client'
import {
  CONSENT_REQUEST_LABELS,
  CONSENT_REQUEST_TYPES,
  HANDOFF_RULE_HINTS,
  HANDOFF_RULE_LABELS,
  isHandoffRule,
  type ConsentRequest,
  type ConsentRequestType,
} from '@/lib/handoff'
import type { Delivery } from '@/lib/types'

type Mode = null | 'text' | 'authorized'

const fieldCls = 'bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl'

export function HandoffPanel({ delivery }: { delivery: Delivery }) {
  const rule = isHandoffRule(delivery.handoffRule) ? delivery.handoffRule : 'door'
  const strict = rule === 'recipient_only'
  const [mode, setMode] = useState<Mode>(null)
  const [busy, setBusy] = useState(false)

  const [reqType, setReqType] = useState<ConsentRequestType>('other_person')
  const [receiverName, setReceiverName] = useState('')
  const [relationship, setRelationship] = useState('')
  const [note, setNote] = useState('')
  const [authVia, setAuthVia] = useState<'in_person_authorization' | 'phone_authorization'>('in_person_authorization')

  const { data, mutate } = useSWR(
    ['consent-request', delivery.id],
    () => authedJson<{ request: ConsentRequest | null }>(`/api/deliveries/${delivery.id}/consent-request`),
    {
      refreshInterval: latest => (latest?.request?.status === 'pending' ? 4000 : 0),
    },
  )
  const latest = data?.request ?? null

  const logEvent = async (type: string, extra: Record<string, unknown> = {}) => {
    const pos = await getPosition()
    await authedJson(`/api/deliveries/${delivery.id}/consent`, {
      method: 'POST',
      body: JSON.stringify({ type, ...extra, lat: pos?.lat, lng: pos?.lng }),
    })
  }

  const quickLog = async (type: string, label: string) => {
    setBusy(true)
    try {
      await logEvent(type)
      toast.success(`${label} logged`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not log')
    } finally {
      setBusy(false)
    }
  }

  const sendTextRequest = async () => {
    setBusy(true)
    try {
      const pos = await getPosition()
      await authedJson(`/api/deliveries/${delivery.id}/consent-request`, {
        method: 'POST',
        body: JSON.stringify({ requestType: reqType, receiverName, relationship, note, lat: pos?.lat, lng: pos?.lng }),
      })
      toast.success('Approval text sent to the recipient')
      setMode(null)
      void mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not send')
    } finally {
      setBusy(false)
    }
  }

  const cancelRequest = async () => {
    setBusy(true)
    try {
      await authedJson(`/api/deliveries/${delivery.id}/consent-request`, { method: 'DELETE' })
      void mutate()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not cancel')
    } finally {
      setBusy(false)
    }
  }

  const recordAuthorization = async () => {
    if (!receiverName.trim()) return toast.error('Enter who the recipient authorized')
    setBusy(true)
    try {
      await logEvent(authVia, { receiverName, relationship, note })
      toast.success('Authorization recorded. You can now complete the handoff.')
      setMode(null)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not record')
    } finally {
      setBusy(false)
    }
  }

  const needsName = reqType === 'other_person' || reqType === 'neighbour'

  return (
    <section
      aria-label="Handoff instructions"
      className={`flex flex-col gap-3 rounded-2xl border p-4 ${
        strict ? 'border-destructive/50 bg-destructive/5' : 'border-[var(--border-color)] bg-[var(--bg-card)]'
      }`}
    >
      <div className="flex items-start gap-3">
        {strict ? (
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" />
        ) : (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent-green)]" aria-hidden="true" />
        )}
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-sm font-semibold text-foreground">
            {HANDOFF_RULE_LABELS[rule]}
            {delivery.handoffRequireId ? ' · ID check' : ''}
          </p>
          <p className="text-xs leading-relaxed text-muted-foreground">{HANDOFF_RULE_HINTS[rule]}</p>
          {rule === 'recipient_or_named' && delivery.handoffNamedPerson && (
            <p className="text-xs text-foreground">
              {'Also allowed: '}
              {delivery.handoffNamedPerson}
              {delivery.handoffNamedRelationship ? ` (${delivery.handoffNamedRelationship})` : ''}
            </p>
          )}
          {delivery.handoffLocationNote && <p className="text-xs text-foreground">{delivery.handoffLocationNote}</p>}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" disabled={busy} onClick={() => quickLog('arrived', 'Arrival')} className="h-10 gap-1.5 rounded-xl">
          <DoorOpen className="h-4 w-4" aria-hidden="true" />
          Arrived
        </Button>
        {delivery.recipientPhone ? (
          <Button variant="outline" size="sm" asChild className="h-10 gap-1.5 rounded-xl">
            <a href={`tel:${delivery.recipientPhone}`} onClick={() => void logEvent('called_recipient').catch(() => {})}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled className="h-10 gap-1.5 rounded-xl">
            <Phone className="h-4 w-4" aria-hidden="true" />
            No phone
          </Button>
        )}
        <Button variant="outline" size="sm" disabled={busy} onClick={() => quickLog('no_answer', 'No answer')} className="h-10 rounded-xl">
          No answer
        </Button>
      </div>

      {latest && latest.status !== 'cancelled' && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-[var(--bg-card-2)] p-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate">
              {CONSENT_REQUEST_LABELS[latest.requestType]}
              {latest.proposedReceiverName ? ` — ${latest.proposedReceiverName}` : ''}
            </span>
          </div>
          <span
            className={`shrink-0 text-xs font-semibold uppercase ${
              latest.status === 'approved'
                ? 'text-[var(--accent-green)]'
                : latest.status === 'pending'
                  ? 'text-amber-500'
                  : 'text-destructive'
            }`}
          >
            {latest.status === 'pending' ? 'Waiting for reply' : latest.status}
          </span>
        </div>
      )}
      {latest?.status === 'pending' && (
        <Button variant="ghost" size="sm" onClick={cancelRequest} disabled={busy} className="self-start">
          Cancel request
        </Button>
      )}
      {latest?.status === 'declined' && (
        <p className="text-xs leading-relaxed text-destructive">
          The recipient declined. Do not leave the delivery. Mark a failed attempt and return it if you cannot reach them.
        </p>
      )}
      {latest?.status === 'expired' && (
        <p className="text-xs leading-relaxed text-amber-500">No reply in time. Try calling, or mark a failed attempt.</p>
      )}

      {mode === null && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-muted-foreground">{"Can't deliver as instructed?"}</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMode('text')}
              disabled={!delivery.recipientPhone || latest?.status === 'pending'}
              className="h-10 gap-1.5 rounded-xl"
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Ask by text
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setMode('authorized')} className="h-10 gap-1.5 rounded-xl">
              <UserCheck className="h-4 w-4" aria-hidden="true" />
              Recipient approved
            </Button>
          </div>
        </div>
      )}

      {mode === 'text' && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="consent-type" className="text-sm">
              Ask the recipient to approve
            </Label>
            <Select value={reqType} onValueChange={v => setReqType(v as ConsentRequestType)}>
              <SelectTrigger id="consent-type" className={fieldCls}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONSENT_REQUEST_TYPES.map(t => (
                  <SelectItem key={t} value={t}>
                    {CONSENT_REQUEST_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {needsName && (
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Their name" aria-label="Their name" value={receiverName} maxLength={80} onChange={e => setReceiverName(e.target.value)} className={fieldCls} />
              <Input placeholder="e.g. Neighbour 4B" aria-label="Relationship" value={relationship} maxLength={60} onChange={e => setRelationship(e.target.value)} className={fieldCls} />
            </div>
          )}
          {reqType === 'other' && (
            <Input placeholder="e.g. leave it in the mailroom" aria-label="What you are asking" value={note} maxLength={160} onChange={e => setNote(e.target.value)} className={fieldCls} />
          )}
          <div className="flex gap-2">
            <Button size="sm" onClick={sendTextRequest} disabled={busy}>
              {busy ? 'Sending...' : 'Send text'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(null)} disabled={busy}>
              Back
            </Button>
          </div>
        </div>
      )}

      {mode === 'authorized' && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border-color)] p-3">
          <Select value={authVia} onValueChange={v => setAuthVia(v as typeof authVia)}>
            <SelectTrigger aria-label="How the recipient approved" className={fieldCls}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_person_authorization">Recipient told me in person</SelectItem>
              <SelectItem value="phone_authorization">Recipient told me on a phone call</SelectItem>
            </SelectContent>
          </Select>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Give to (name)" aria-label="Authorized person name" value={receiverName} maxLength={80} onChange={e => setReceiverName(e.target.value)} className={fieldCls} />
            <Input placeholder="Relationship" aria-label="Relationship" value={relationship} maxLength={60} onChange={e => setRelationship(e.target.value)} className={fieldCls} />
          </div>
          <Textarea placeholder="What did the recipient say? (optional)" aria-label="Notes" value={note} maxLength={400} onChange={e => setNote(e.target.value)} rows={2} className={`${fieldCls} resize-none`} />
          <div className="flex gap-2">
            <Button size="sm" onClick={recordAuthorization} disabled={busy}>
              {busy ? 'Saving...' : 'Record approval'}
            </Button>
            <Button size="sm" variant="outline" onClick={() => setMode(null)} disabled={busy}>
              Back
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}
