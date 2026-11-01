'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Panel, jsonFetcher, sendJson } from './shared'

type Prefs = {
  email_failed?: boolean
  email_consent?: boolean
  email_late?: boolean
  email_issue_updates?: boolean
  alert_email?: string | null
}

const ROWS: { key: keyof Prefs; label: string; hint: string }[] = [
  { key: 'email_failed', label: 'Failed delivery attempts', hint: 'Courier could not complete the drop-off.' },
  { key: 'email_consent', label: 'Recipient approvals', hint: 'A recipient declines, or does not answer, a safe-drop or neighbour request.' },
  { key: 'email_late', label: 'Running late', hint: 'An order is more than 30 minutes past its expected time.' },
  { key: 'email_issue_updates', label: 'Problem case updates', hint: 'Dispatch replies to, or resolves, a case you opened.' },
]

export function AlertSettings() {
  const { data, mutate } = useSWR<{ alertPrefs: Prefs }>('/api/business/preferences', jsonFetcher)
  const [prefs, setPrefs] = useState<Prefs>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (data) setPrefs({ email_failed: true, email_consent: true, email_late: false, email_issue_updates: true, ...data.alertPrefs })
  }, [data])

  const save = async () => {
    setSaving(true)
    try {
      await sendJson('/api/business/preferences', 'PATCH', { alertPrefs: prefs })
      toast.success('Alert preferences saved')
      void mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Panel
      title="Email alerts"
      description="In-app alerts always appear in the bell and the Needs attention list. Choose which ones also go to email."
      action={<Button size="sm" onClick={save} disabled={saving || !data}>{saving ? 'Saving…' : 'Save'}</Button>}
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y divide-border">
          {ROWS.map((r) => (
            <li key={r.key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
              <div>
                <Label htmlFor={`pref-${r.key}`} className="text-sm font-medium">{r.label}</Label>
                <p className="text-xs leading-relaxed text-muted-foreground">{r.hint}</p>
              </div>
              <Switch
                id={`pref-${r.key}`}
                checked={!!prefs[r.key]}
                onCheckedChange={(v) => setPrefs((p) => ({ ...p, [r.key]: v }))}
              />
            </li>
          ))}
        </ul>
        <div className="flex max-w-sm flex-col gap-1.5">
          <Label htmlFor="alert-email">Send alerts to</Label>
          <Input
            id="alert-email"
            type="email"
            placeholder="Defaults to your billing email"
            value={prefs.alert_email ?? ''}
            onChange={(e) => setPrefs((p) => ({ ...p, alert_email: e.target.value }))}
          />
        </div>
      </div>
    </Panel>
  )
}
