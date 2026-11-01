'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { Plus, Trash2 } from 'lucide-react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { describeSchedule, WEEKDAY_SHORT, type RecurringFrequency } from '@/lib/recurring'
import { cn } from '@/lib/utils'
import { Panel, jsonFetcher, sendJson } from './shared'

interface Schedule {
  id: string
  name: string
  frequency: RecurringFrequency
  days_of_week: number[]
  time_of_day: string
  active: boolean
  next_run_at: string | null
  last_run_at: string | null
  template: { dropoffAddress?: string; recipientName?: string | null }
}

const blank = {
  name: '', locationId: '', frequency: 'weekdays' as RecurringFrequency, daysOfWeek: [] as number[], timeOfDay: '09:00',
  dropoffAddress: '', dropoffArea: '', recipientName: '', recipientPhone: '', requireSignature: false, requirePin: false,
}

export function RecurringSettings() {
  const { currentUser, businesses } = useApp()
  const locations = useMemo(
    () => businesses.find((b) => b.id === currentUser?.businessId)?.locations ?? [],
    [businesses, currentUser?.businessId],
  )
  const { data, mutate, isLoading } = useSWR<{ schedules: Schedule[] }>('/api/business/recurring', jsonFetcher)
  const [form, setForm] = useState<typeof blank | null>(null)
  const [busy, setBusy] = useState(false)

  const create = async () => {
    if (!form) return
    setBusy(true)
    try {
      await sendJson('/api/business/recurring', 'POST', {
        name: form.name,
        locationId: form.locationId,
        frequency: form.frequency,
        daysOfWeek: form.daysOfWeek,
        timeOfDay: form.timeOfDay,
        template: {
          dropoffAddress: form.dropoffAddress,
          dropoffArea: form.dropoffArea || form.dropoffAddress.split(',').slice(-2, -1)[0]?.trim() || 'Local',
          recipientName: form.recipientName || null,
          recipientPhone: form.recipientPhone || null,
          requireSignature: form.requireSignature,
          requirePin: form.requirePin,
        },
      })
      toast.success('Recurring delivery scheduled')
      setForm(null)
      void mutate()
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = async (s: Schedule, active: boolean) => {
    try {
      await sendJson('/api/business/recurring', 'PATCH', { id: s.id, active })
      void mutate()
    } catch (e) { toast.error((e as Error).message) }
  }
  const remove = async (s: Schedule) => {
    try {
      await sendJson(`/api/business/recurring?id=${s.id}`, 'DELETE')
      toast.success('Schedule removed')
      void mutate()
    } catch (e) { toast.error((e as Error).message) }
  }

  const schedules = data?.schedules ?? []

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Recurring deliveries"
        description="Standing runs like daily bank drops or weekly lab pickups. We post the order automatically at the time you choose."
        action={!form && (
          <Button size="sm" className="gap-1.5" onClick={() => setForm({ ...blank, locationId: locations[0]?.id ?? '' })}>
            <Plus className="size-4" aria-hidden /> New schedule
          </Button>
        )}
      >
        {form && (
          <div className="mb-6 flex flex-col gap-4 rounded-lg border border-border p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field id="rs-name" label="Name">
                <Input id="rs-name" placeholder="Morning bank drop" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </Field>
              <Field id="rs-loc" label="Pickup from">
                <Select value={form.locationId} onValueChange={(v) => setForm({ ...form, locationId: v })}>
                  <SelectTrigger id="rs-loc"><SelectValue placeholder="Choose a location" /></SelectTrigger>
                  <SelectContent>{locations.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field id="rs-addr" label="Drop-off address">
                <Input id="rs-addr" placeholder="123 Main St, Toronto, ON" value={form.dropoffAddress} onChange={(e) => setForm({ ...form, dropoffAddress: e.target.value })} />
              </Field>
              <Field id="rs-area" label="Area or city">
                <Input id="rs-area" placeholder="Toronto" value={form.dropoffArea} onChange={(e) => setForm({ ...form, dropoffArea: e.target.value })} />
              </Field>
              <Field id="rs-rname" label="Recipient name">
                <Input id="rs-rname" value={form.recipientName} onChange={(e) => setForm({ ...form, recipientName: e.target.value })} />
              </Field>
              <Field id="rs-rphone" label="Recipient phone">
                <Input id="rs-rphone" type="tel" value={form.recipientPhone} onChange={(e) => setForm({ ...form, recipientPhone: e.target.value })} />
              </Field>
              <Field id="rs-freq" label="Repeats">
                <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v as RecurringFrequency })}>
                  <SelectTrigger id="rs-freq"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Every day</SelectItem>
                    <SelectItem value="weekdays">Weekdays</SelectItem>
                    <SelectItem value="weekly">Specific days</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field id="rs-time" label="Post at">
                <Input id="rs-time" type="time" value={form.timeOfDay} onChange={(e) => setForm({ ...form, timeOfDay: e.target.value })} />
              </Field>
            </div>
            {form.frequency === 'weekly' && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Days of the week">
                {WEEKDAY_SHORT.map((d, i) => {
                  const on = form.daysOfWeek.includes(i)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setForm({ ...form, daysOfWeek: on ? form.daysOfWeek.filter((x) => x !== i) : [...form.daysOfWeek, i] })}
                      className={cn('h-8 rounded-md border px-3 text-xs font-medium transition-colors',
                        on ? 'border-brand bg-brand text-brand-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
                    >
                      {d}
                    </button>
                  )
                })}
              </div>
            )}
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.requireSignature} onCheckedChange={(v) => setForm({ ...form, requireSignature: v })} /> Require signature</label>
              <label className="flex items-center gap-2 text-sm"><Switch checked={form.requirePin} onCheckedChange={(v) => setForm({ ...form, requirePin: v })} /> Require delivery PIN</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
              <Button size="sm" onClick={create} disabled={busy}>{busy ? 'Saving…' : 'Create schedule'}</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : schedules.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recurring deliveries yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {schedules.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-4 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{s.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {describeSchedule(s.frequency, s.days_of_week, s.time_of_day)} · to {s.template?.dropoffAddress ?? '—'}
                  </p>
                </div>
                <p className="font-mono text-xs tabular-nums text-muted-foreground">
                  {s.active && s.next_run_at ? `Next ${format(new Date(s.next_run_at), 'EEE MMM d, h:mm a')}` : 'Paused'}
                </p>
                <Switch aria-label={`${s.active ? 'Pause' : 'Resume'} ${s.name}`} checked={s.active} onCheckedChange={(v) => toggle(s, v)} />
                <Button variant="ghost" size="icon" className="size-8" aria-label={`Delete ${s.name}`} onClick={() => remove(s)}>
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
