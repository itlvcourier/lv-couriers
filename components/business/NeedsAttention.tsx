'use client'

import useSWR from 'swr'
import { formatDistanceToNow } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface AttentionItem {
  id: string
  kind: string
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

const fetcher = async (url: string) => {
  const r = await fetch(url)
  if (!r.ok) throw new Error('Request failed')
  return r.json()
}

export function useAttention() {
  return useSWR<{ items: AttentionItem[] }>('/api/business/attention', fetcher, { refreshInterval: 30_000 })
}

export function NeedsAttention({ onOpen }: { onOpen: (deliveryId: string) => void }) {
  const { data, isLoading } = useAttention()
  const items = data?.items ?? []
  if (isLoading || items.length === 0) return null

  return (
    <section aria-labelledby="needs-attention" className="overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="size-1.5 rounded-full bg-warning" />
          <h2 id="needs-attention" className="text-sm font-medium text-foreground">Needs attention</h2>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">{items.length}</span>
        </div>
        <p className="hidden text-xs text-muted-foreground sm:block">Updates every 30 seconds</p>
      </header>
      <ul className="divide-y divide-border">
        {items.slice(0, 6).map((it) => (
          <li key={it.id}>
            <button
              type="button"
              onClick={() => onOpen(it.deliveryId)}
              className="flex w-full items-center gap-4 px-4 py-3 text-left transition-colors hover:bg-muted/40 focus-visible:bg-muted/40 focus-visible:outline-none"
            >
              <span
                aria-hidden
                className={cn('h-8 w-0.5 shrink-0 rounded-full', it.severity === 'bad' ? 'bg-destructive' : 'bg-warning')}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{it.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[it.trackingCode, it.recipient, it.detail].filter(Boolean).join(' · ')}
                </p>
              </div>
              <time dateTime={it.at} className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {formatDistanceToNow(new Date(it.at), { addSuffix: true })}
              </time>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      {items.length > 6 && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {items.length - 6} more flagged orders in the list below
        </p>
      )}
    </section>
  )
}
