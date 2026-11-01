'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { authedJson } from '@/lib/api-client'
import { cn } from '@/lib/utils'

type IssueStatus = 'open' | 'investigating' | 'resolved' | 'rejected'

interface Issue {
  id: string
  issue_type: string
  description: string | null
  photo_url: string | null
  status: IssueStatus
  resolution: string | null
  credit_amount: number | null
  created_at: string
  resolved_at: string | null
  businesses: { name: string } | null
  deliveries: { tracking_code: string | null; recipient_name: string | null; dropoff_address: string | null } | null
}

const TYPE_LABEL: Record<string, string> = {
  damaged: 'Damaged',
  missing: 'Missing item',
  late: 'Late',
  wrong_address: 'Wrong address',
  not_received: 'Not received',
  driver_conduct: 'Driver conduct',
  other: 'Other',
}

const FILTERS: { id: 'active' | IssueStatus | 'all'; label: string }[] = [
  { id: 'active', label: 'Active' },
  { id: 'resolved', label: 'Resolved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'all', label: 'All' },
]

const fetcher = (url: string) => authedJson<{ issues: Issue[] }>(url).then((r) => r.issues ?? [])

export function AdminIssues() {
  const { data, isLoading, mutate } = useSWR('/api/issues', fetcher, { refreshInterval: 30000 })
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['id']>('active')
  const [openId, setOpenId] = useState<string | null>(null)

  const issues = (data ?? []).filter((i) =>
    filter === 'all' ? true : filter === 'active' ? i.status === 'open' || i.status === 'investigating' : i.status === filter,
  )
  const activeCount = (data ?? []).filter((i) => i.status === 'open' || i.status === 'investigating').length

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold text-foreground">Problem cases</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Issues reported by businesses. Each resolution is shown back to the business on the order.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Filter cases">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            role="tab"
            aria-selected={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
              filter === f.id
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            {f.label}
            {f.id === 'active' && activeCount > 0 && <span className="ml-1.5 tabular-nums">{activeCount}</span>}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <Spinner className="size-5" />
        </div>
      ) : issues.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          No cases in this view.
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                onClick={() => setOpenId(openId === issue.id ? null : issue.id)}
                aria-expanded={openId === issue.id}
                className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/40"
              >
                <StatusDot status={issue.status} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {TYPE_LABEL[issue.issue_type] ?? issue.issue_type}
                    <span className="font-normal text-muted-foreground"> · {issue.businesses?.name ?? 'Unknown business'}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {issue.deliveries?.tracking_code ?? '—'} · {issue.deliveries?.recipient_name ?? 'Recipient'} ·{' '}
                    {new Date(issue.created_at).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs capitalize text-muted-foreground">{issue.status}</span>
              </button>
              {openId === issue.id && <IssueEditor issue={issue} onSaved={() => mutate()} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: IssueStatus }) {
  const tone =
    status === 'open'
      ? 'bg-destructive'
      : status === 'investigating'
        ? 'bg-warning'
        : status === 'resolved'
          ? 'bg-[var(--accent-green)]'
          : 'bg-muted-foreground'
  return <span className={cn('size-2 shrink-0 rounded-full', tone)} aria-hidden />
}

function IssueEditor({ issue, onSaved }: { issue: Issue; onSaved: () => void }) {
  const [resolution, setResolution] = useState(issue.resolution ?? '')
  const [credit, setCredit] = useState(issue.credit_amount != null ? String(issue.credit_amount) : '')
  const [saving, setSaving] = useState<IssueStatus | null>(null)

  const save = async (status: IssueStatus) => {
    if ((status === 'resolved' || status === 'rejected') && !resolution.trim()) {
      toast.error('Add a note for the business before closing the case')
      return
    }
    const creditAmount = credit.trim() ? Number(credit) : null
    if (creditAmount != null && (!Number.isFinite(creditAmount) || creditAmount < 0)) {
      toast.error('Credit must be a positive amount')
      return
    }
    setSaving(status)
    try {
      await authedJson('/api/issues', {
        method: 'PATCH',
        body: JSON.stringify({ id: issue.id, status, resolution: resolution.trim() || null, creditAmount }),
      })
      toast.success(`Case marked ${status}`)
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update case')
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex flex-col gap-4 border-t border-border bg-background/40 px-4 py-4">
      {issue.description && (
        <p className="text-pretty text-sm leading-relaxed text-foreground">{issue.description}</p>
      )}
      {issue.deliveries?.dropoff_address && (
        <p className="text-xs text-muted-foreground">Drop-off: {issue.deliveries.dropoff_address}</p>
      )}
      {issue.photo_url?.startsWith('https://') && (
        <a href={issue.photo_url} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
          View attached photo
        </a>
      )}
      <div className="flex flex-col gap-2">
        <label htmlFor={`res-${issue.id}`} className="text-xs font-medium text-muted-foreground">
          Note to business
        </label>
        <Textarea id={`res-${issue.id}`} value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} />
      </div>
      <div className="flex flex-col gap-2 sm:max-w-48">
        <label htmlFor={`credit-${issue.id}`} className="text-xs font-medium text-muted-foreground">
          Credit (CAD, optional)
        </label>
        <Input id={`credit-${issue.id}`} inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value)} placeholder="0.00" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" disabled={!!saving} onClick={() => save('investigating')}>
          {saving === 'investigating' ? <Spinner className="size-4" /> : 'Investigating'}
        </Button>
        <Button size="sm" disabled={!!saving} onClick={() => save('resolved')}>
          {saving === 'resolved' ? <Spinner className="size-4" /> : 'Resolve'}
        </Button>
        <Button size="sm" variant="ghost" disabled={!!saving} onClick={() => save('rejected')}>
          {saving === 'rejected' ? <Spinner className="size-4" /> : 'Reject'}
        </Button>
      </div>
    </div>
  )
}
