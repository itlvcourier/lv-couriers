'use client'

import useSWR from 'swr'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { ISSUE_TYPES } from '@/components/shared/OrderActivity'
import { Panel, jsonFetcher } from './shared'

export interface IssueRow {
  id: string
  delivery_id: string
  issue_type: string
  description: string | null
  status: 'open' | 'investigating' | 'resolved' | 'rejected'
  resolution: string | null
  credit_amount: number | null
  created_at: string
  resolved_at: string | null
  businesses?: { name: string } | null
  deliveries?: { tracking_code: string | null; recipient_name: string | null; dropoff_address: string | null } | null
}

export const issueLabel = (t: string) => ISSUE_TYPES.find((x) => x.value === t)?.label ?? t.replace(/_/g, ' ')

export const STATUS_STYLE: Record<IssueRow['status'], string> = {
  open: 'text-warning',
  investigating: 'text-brand',
  resolved: 'text-success',
  rejected: 'text-muted-foreground',
}

export function IssueCases() {
  const { data, isLoading } = useSWR<{ issues: IssueRow[] }>('/api/issues', jsonFetcher, { refreshInterval: 60_000 })
  const issues = data?.issues ?? []
  const open = issues.filter((i) => i.status === 'open' || i.status === 'investigating').length
  const resolved = issues.filter((i) => i.resolved_at)
  const avgHours = resolved.length
    ? resolved.reduce((s, i) => s + (new Date(i.resolved_at!).getTime() - new Date(i.created_at).getTime()), 0) / resolved.length / 36e5
    : null
  const credits = issues.reduce((s, i) => s + (Number(i.credit_amount) || 0), 0)

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card sm:grid-cols-4">
        {[
          ['Open cases', String(open)],
          ['Total reported', String(issues.length)],
          ['Avg. time to resolve', avgHours == null ? '—' : avgHours < 1 ? `${Math.round(avgHours * 60)} min` : `${avgHours.toFixed(1)} h`],
          ['Credits issued', `$${credits.toFixed(2)}`],
        ].map(([k, v], i) => (
          <div key={k} className={cn('flex flex-col gap-1 p-4', i > 0 && 'border-l border-border', i === 2 && 'max-sm:border-l-0 max-sm:border-t', i === 3 && 'max-sm:border-t')}>
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="font-mono text-xl tabular-nums text-foreground">{v}</dd>
          </div>
        ))}
      </dl>

      <Panel title="Problem cases" description="Open a case from any order's detail sheet with Report a problem. Dispatch replies here.">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : issues.length === 0 ? (
          <p className="text-sm text-muted-foreground">No problems reported. Good.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {issues.map((i) => (
              <li key={i.id} className="flex flex-col gap-1 py-3 first:pt-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">
                    {issueLabel(i.issue_type)}
                    <span className="ml-2 font-mono text-xs font-normal text-muted-foreground">{i.deliveries?.tracking_code ?? i.delivery_id.slice(0, 8)}</span>
                  </p>
                  <span className={cn('text-xs font-medium capitalize', STATUS_STYLE[i.status])}>{i.status}</span>
                </div>
                {i.description && <p className="text-pretty text-xs leading-relaxed text-muted-foreground">{i.description}</p>}
                {i.resolution && (
                  <p className="text-pretty text-xs leading-relaxed text-foreground">
                    Dispatch: {i.resolution}{i.credit_amount ? ` · $${Number(i.credit_amount).toFixed(2)} credit` : ''}
                  </p>
                )}
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">Opened {format(new Date(i.created_at), 'MMM d, h:mm a')}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
