'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Flag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface TimelineEntry {
  id: string
  at: string
  kind: string
  tone: 'neutral' | 'good' | 'warn' | 'bad'
  title: string
  detail?: string | null
  actor?: string | null
  photoUrl?: string | null
}

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'Request failed')
  return r.json()
}

export const ISSUE_TYPES: { value: string; label: string }[] = [
  { value: 'not_received', label: 'Recipient says not received' },
  { value: 'damaged', label: 'Package damaged' },
  { value: 'missing_items', label: 'Items missing' },
  { value: 'wrong_address', label: 'Delivered to wrong address' },
  { value: 'late', label: 'Delivery was late' },
  { value: 'driver_conduct', label: 'Courier conduct' },
  { value: 'other', label: 'Something else' },
]

const TONE_DOT: Record<TimelineEntry['tone'], string> = {
  neutral: 'bg-muted-foreground/50',
  good: 'bg-success',
  warn: 'bg-warning',
  bad: 'bg-destructive',
}

export function OrderActivity({ deliveryId, canReport }: { deliveryId: string; canReport: boolean }) {
  const { data, error, isLoading, mutate } = useSWR<{ entries: TimelineEntry[] }>(
    `/api/deliveries/${deliveryId}/timeline`,
    fetcher,
    { refreshInterval: 20_000 },
  )
  const [reporting, setReporting] = useState(false)
  const [type, setType] = useState('')
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!type) return toast.error('Choose what went wrong')
    setBusy(true)
    try {
      const r = await fetch('/api/issues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deliveryId, issueType: type, description: desc }),
      })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error ?? 'Could not submit')
      toast.success('Problem reported. Our team will follow up.')
      setReporting(false)
      setType('')
      setDesc('')
      void mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const entries = data?.entries ?? []

  return (
    <section aria-labelledby={`activity-${deliveryId}`} className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 id={`activity-${deliveryId}`} className="text-sm font-medium text-muted-foreground">Activity</h4>
        {canReport && !reporting && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-muted-foreground" onClick={() => setReporting(true)}>
            <Flag className="size-3.5" aria-hidden />
            Report a problem
          </Button>
        )}
      </div>

      {reporting && (
        <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`issue-type-${deliveryId}`}>What went wrong?</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger id={`issue-type-${deliveryId}`}><SelectValue placeholder="Choose an issue" /></SelectTrigger>
              <SelectContent>
                {ISSUE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor={`issue-desc-${deliveryId}`}>Details</Label>
            <Textarea
              id={`issue-desc-${deliveryId}`}
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What happened, and what outcome do you need?"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReporting(false)} disabled={busy}>Cancel</Button>
            <Button size="sm" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Submit report'}</Button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-xs text-muted-foreground">Loading activity…</p>}
      {error && <p className="text-xs text-destructive">Could not load activity.</p>}
      {!isLoading && !error && entries.length === 0 && (
        <p className="text-xs text-muted-foreground">No activity recorded yet.</p>
      )}

      {entries.length > 0 && (
        <ol className="relative flex flex-col gap-4 border-l border-border pl-5">
          {entries.map((e) => (
            <li key={e.id} className="relative">
              <span aria-hidden className={cn('absolute -left-[25px] top-1.5 size-2 rounded-full ring-4 ring-background', TONE_DOT[e.tone])} />
              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                <p className="text-sm font-medium text-foreground">{e.title}</p>
                <time dateTime={e.at} className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {format(new Date(e.at), 'MMM d, h:mm a')}
                </time>
              </div>
              {(e.detail || e.actor) && (
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  {[e.actor, e.detail].filter(Boolean).join(' · ')}
                </p>
              )}
              {e.photoUrl && (
                <a href={e.photoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                  <img src={e.photoUrl} alt="Proof of delivery" className="h-20 w-28 rounded-md border border-border object-cover" />
                </a>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
