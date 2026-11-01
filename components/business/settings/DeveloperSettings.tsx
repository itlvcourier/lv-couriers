'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { Copy, KeyRound, Trash2, Webhook } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { Panel, jsonFetcher, sendJson } from './shared'

interface DevData {
  keys: { id: string; name: string; key_prefix: string; last_used_at: string | null; revoked_at: string | null; created_at: string }[]
  webhooks: { id: string; url: string; events: string[]; active: boolean; created_at: string }[]
  recentDeliveries: { id: string; endpoint_id: string; event: string; status_code: number | null; error: string | null; created_at: string }[]
  events: string[]
}

export function DeveloperSettings() {
  const { data, mutate } = useSWR<DevData>('/api/business/developer', jsonFetcher)
  const [secret, setSecret] = useState<{ label: string; value: string } | null>(null)
  const [keyName, setKeyName] = useState('')
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const act = async (body: Record<string, unknown>, ok?: string) => {
    setBusy(true)
    try {
      const j = await sendJson('/api/business/developer', 'POST', body)
      if (j.key) setSecret({ label: 'API key', value: j.key })
      if (j.secret) setSecret({ label: 'Webhook signing secret', value: j.secret })
      if (ok) toast.success(ok)
      void mutate()
      return j
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const activeKeys = data?.keys.filter((k) => !k.revoked_at) ?? []

  return (
    <div className="flex flex-col gap-6">
      {secret && (
        <div role="status" className="flex flex-col gap-2 rounded-xl border border-brand/40 bg-brand/5 p-4">
          <p className="text-sm font-medium text-foreground">Copy your {secret.label.toLowerCase()} now. It will not be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 truncate rounded-md bg-muted px-3 py-2 font-mono text-xs text-foreground">{secret.value}</code>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => { void navigator.clipboard.writeText(secret.value); toast.success('Copied') }}>
              <Copy className="size-3.5" aria-hidden /> Copy
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSecret(null)}>Done</Button>
          </div>
        </div>
      )}

      <Panel title="API keys" description="Create orders from your own system (POS, Shopify, ERP). Send the key as a Bearer token.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input aria-label="Key name" placeholder="Key name, e.g. Shopify store" value={keyName} onChange={(e) => setKeyName(e.target.value)} className="sm:max-w-xs" />
            <Button size="sm" className="gap-1.5" disabled={busy} onClick={() => act({ action: 'create_key', name: keyName || 'API key' }).then(() => setKeyName(''))}>
              <KeyRound className="size-4" aria-hidden /> Generate key
            </Button>
          </div>
          {activeKeys.length > 0 && (
            <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {activeKeys.map((k) => (
                <li key={k.id} className="flex items-center gap-3 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-foreground">{k.name}</p>
                    <p className="font-mono text-xs text-muted-foreground">{k.key_prefix}…</p>
                  </div>
                  <p className="hidden text-xs text-muted-foreground sm:block">
                    {k.last_used_at ? `Used ${formatDistanceToNow(new Date(k.last_used_at), { addSuffix: true })}` : 'Never used'}
                  </p>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => act({ action: 'revoke_key', id: k.id }, 'Key revoked')}>Revoke</Button>
                </li>
              ))}
            </ul>
          )}
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">{`curl -X POST ${origin}/api/v1/deliveries \\
  -H "Authorization: Bearer YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -H "Idempotency-Key: your-order-id-123" \\
  -d '{"dropoff_address":"123 Main St, Toronto","dropoff_area":"Downtown","recipient_name":"Sam","recipient_phone":"+14165550100"}'`}</pre>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Send the same <span className="font-mono">Idempotency-Key</span> when retrying and you get the original order back instead of a duplicate.
            Optional fields: <span className="font-mono">dropoff_lat</span>, <span className="font-mono">dropoff_lng</span>, <span className="font-mono">buzz_code</span>, <span className="font-mono">recipient_note</span>, <span className="font-mono">is_rush</span>, <span className="font-mono">require_signature</span>, <span className="font-mono">require_pin</span>, <span className="font-mono">handoff_rule</span>, <span className="font-mono">handoff_require_id</span>, <span className="font-mono">handoff_named_person</span>, <span className="font-mono">items</span>, <span className="font-mono">location_id</span>.
          </p>
        </div>
      </Panel>

      <Panel title="Connect to Claude (MCP)" description="Let Claude book, track and cancel deliveries for this account. It uses an API key from above, so all order rules and duplicate protection apply.">
        <div className="flex flex-col gap-3">
          <p className="text-xs leading-relaxed text-muted-foreground">Claude Code:</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">{`claude mcp add --transport http doms ${origin}/api/mcp \\
  --header "Authorization: Bearer YOUR_KEY"`}</pre>
          <p className="text-xs leading-relaxed text-muted-foreground">Claude Desktop (claude_desktop_config.json):</p>
          <pre className="overflow-x-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">{`{
  "mcpServers": {
    "doms": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "${origin}/api/mcp",
               "--header", "Authorization: Bearer YOUR_KEY"]
    }
  }
}`}</pre>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Tools: <span className="font-mono">create_delivery</span>, <span className="font-mono">get_delivery</span>, <span className="font-mono">list_deliveries</span>, <span className="font-mono">cancel_delivery</span>, <span className="font-mono">list_pickup_locations</span>.
            Use a dedicated key named &quot;Claude&quot; so you can revoke it on its own.
          </p>
        </div>
      </Panel>

      <Panel title="Webhooks" description="We POST signed JSON to your URL whenever an order changes status. Verify X-Doms-Signature: HMAC-SHA256 of `${timestamp}.${raw body}` using your secret. Reply 2xx within 8s; failures retry for about 9 hours. Use X-Doms-Event-Id to ignore duplicates.">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <Input aria-label="Endpoint URL" placeholder="https://example.com/webhooks/doms" value={url} onChange={(e) => setUrl(e.target.value)} />
            <fieldset className="flex flex-wrap gap-x-5 gap-y-2">
              <legend className="sr-only">Events</legend>
              {(data?.events ?? []).map((ev) => (
                <label key={ev} className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Checkbox checked={events.includes(ev)} onCheckedChange={(v) => setEvents(v ? [...events, ev] : events.filter((x) => x !== ev))} />
                  {ev}
                </label>
              ))}
            </fieldset>
            <p className="text-xs text-muted-foreground">Leave all unchecked to receive every event.</p>
            <div className="flex justify-end">
              <Button size="sm" className="gap-1.5" disabled={busy || !url} onClick={() => act({ action: 'create_webhook', url, events }, 'Endpoint added').then((j) => { if (j) { setUrl(''); setEvents([]) } })}>
                <Webhook className="size-4" aria-hidden /> Add endpoint
              </Button>
            </div>
          </div>

          {(data?.webhooks ?? []).map((w) => {
            const recent = (data?.recentDeliveries ?? []).filter((d) => d.endpoint_id === w.id).slice(0, 5)
            return (
              <div key={w.id} className="flex flex-col gap-2 rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <p className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">{w.url}</p>
                  <Button size="sm" variant="outline" onClick={() => act({ action: 'test_webhook', id: w.id }, 'Test event sent')}>Send test</Button>
                  <Switch aria-label="Endpoint enabled" checked={w.active} onCheckedChange={(v) => act({ action: 'toggle_webhook', id: w.id, active: v })} />
                  <Button size="icon" variant="ghost" className="size-8" aria-label="Delete endpoint" onClick={() => act({ action: 'delete_webhook', id: w.id }, 'Endpoint deleted')}>
                    <Trash2 className="size-4" aria-hidden />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">{w.events.length ? w.events.join(', ') : 'All events'}</p>
                {recent.length > 0 && (
                  <ul className="flex flex-col gap-1 border-t border-border pt-2">
                    {recent.map((d) => {
                      const ok = d.status_code != null && d.status_code < 300
                      return (
                        <li key={d.id} className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                          <span className={cn('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-destructive')} aria-hidden />
                          <span className="flex-1 truncate">{d.event}</span>
                          <span>{d.status_code ?? (d.error ? 'error' : '—')}</span>
                          <span>{formatDistanceToNow(new Date(d.created_at), { addSuffix: true })}</span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
