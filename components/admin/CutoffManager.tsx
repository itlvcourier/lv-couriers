'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { Clock, Save, Plus, Trash2, AlarmClock } from 'lucide-react'
import {
  type BusinessCutoff,
  getAllBusinessCutoffs,
  setDefaultCutoff,
  setDayOverride,
  evaluateCutoff,
} from '@/lib/cutoffs'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TZ = 'America/Edmonton'

export function CutoffManager() {
  const { businesses } = useApp()
  const [cutoffsByBiz, setCutoffsByBiz] = useState<Record<string, BusinessCutoff[]>>({})
  const [loading, setLoading] = useState(true)

  const reload = () => {
    setLoading(true)
    getAllBusinessCutoffs()
      .then(setCutoffsByBiz)
      .catch((e) => toast.error(e instanceof Error ? e.message : 'Failed to load cutoffs'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reload()
  }, [])

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">Loading cutoffs…</CardContent>
      </Card>
    )
  }

  if (businesses.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          No businesses yet. Add a business before configuring cutoffs.
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <AlarmClock className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Daily Cutoffs</h3>
          <p className="text-sm text-muted-foreground">
            Set a same-day cutoff per business. Orders posted after the cutoff route to the approval queue as late requests.
            All times are {TZ.replace('_', ' ')}.
          </p>
        </div>
      </div>

      {businesses.map((biz) => (
        <BusinessCutoffCard
          key={biz.id}
          businessId={biz.id}
          businessName={biz.name}
          cutoffs={cutoffsByBiz[biz.id] ?? []}
          onChanged={reload}
        />
      ))}
    </div>
  )
}

function timeToHHMM(t: string | null | undefined): string {
  if (!t) return ''
  return t.split(':').slice(0, 2).join(':')
}

function BusinessCutoffCard({
  businessId,
  businessName,
  cutoffs,
  onChanged,
}: {
  businessId: string
  businessName: string
  cutoffs: BusinessCutoff[]
  onChanged: () => void
}) {
  const defaultRow = cutoffs.find((c) => c.dayOfWeek === null) ?? null
  const overrides = cutoffs.filter((c) => c.dayOfWeek !== null)

  const [defaultTime, setDefaultTime] = useState(timeToHHMM(defaultRow?.cutoffTime))
  const [savingDefault, setSavingDefault] = useState(false)
  const [newDay, setNewDay] = useState<number>(1)
  const [newTime, setNewTime] = useState('')
  const [addingOverride, setAddingOverride] = useState(false)

  useEffect(() => {
    setDefaultTime(timeToHHMM(defaultRow?.cutoffTime))
  }, [defaultRow?.cutoffTime])

  const status = useMemo(() => (cutoffs.length ? evaluateCutoff(cutoffs) : null), [cutoffs])

  const saveDefault = async () => {
    setSavingDefault(true)
    try {
      await setDefaultCutoff(businessId, defaultTime || null, TZ)
      toast.success(defaultTime ? `Default cutoff set for ${businessName}` : `Default cutoff cleared`)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save cutoff')
    } finally {
      setSavingDefault(false)
    }
  }

  const addOverride = async () => {
    if (!newTime) {
      toast.error('Pick a time for the override')
      return
    }
    setAddingOverride(true)
    try {
      await setDayOverride(businessId, newDay, newTime, TZ)
      toast.success(`${DAYS[newDay]} override saved`)
      setNewTime('')
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save override')
    } finally {
      setAddingOverride(false)
    }
  }

  const removeOverride = async (dow: number) => {
    try {
      await setDayOverride(businessId, dow, null, TZ)
      toast.success(`${DAYS[dow]} override removed`)
      onChanged()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to remove override')
    }
  }

  const usedDays = new Set(overrides.map((o) => o.dayOfWeek as number))
  const availableDays = DAYS.map((_, i) => i).filter((i) => !usedDays.has(i))

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            {businessName}
          </CardTitle>
          {status?.hasCutoff ? (
            <Badge variant={status.isPastCutoff ? 'destructive' : 'outline'}>
              {status.isPastCutoff ? 'Past cutoff now' : 'Open now'} · {status.cutoffTime}
            </Badge>
          ) : (
            <Badge variant="secondary">No cutoff</Badge>
          )}
        </div>
        <CardDescription>Default applies every day unless a weekday override exists.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Default cutoff */}
        <div className="flex items-end gap-3 flex-wrap">
          <div className="space-y-1.5">
            <Label htmlFor={`default-${businessId}`} className="text-xs">Default cutoff</Label>
            <Input
              id={`default-${businessId}`}
              type="time"
              value={defaultTime}
              onChange={(e) => setDefaultTime(e.target.value)}
              className="h-9 w-36"
            />
          </div>
          <Button onClick={saveDefault} disabled={savingDefault} size="sm" className="h-9">
            <Save className="w-4 h-4 mr-1.5" />
            {savingDefault ? 'Saving…' : 'Save'}
          </Button>
          {defaultRow && (
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-destructive hover:text-destructive"
              onClick={() => {
                setDefaultTime('')
                void setDefaultCutoff(businessId, null, TZ).then(() => {
                  toast.success('Default cutoff cleared')
                  onChanged()
                })
              }}
            >
              Clear
            </Button>
          )}
        </div>

        {(overrides.length > 0 || availableDays.length > 0) && <Separator />}

        {/* Overrides */}
        {overrides.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Weekday overrides</Label>
            <div className="flex flex-wrap gap-2">
              {overrides
                .slice()
                .sort((a, b) => (a.dayOfWeek as number) - (b.dayOfWeek as number))
                .map((o) => (
                  <div
                    key={o.id}
                    className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-2.5 py-1.5"
                  >
                    <span className="text-sm font-medium">{DAYS[o.dayOfWeek as number]}</span>
                    <span className="text-sm text-muted-foreground">{timeToHHMM(o.cutoffTime)}</span>
                    <button
                      type="button"
                      onClick={() => removeOverride(o.dayOfWeek as number)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove ${DAYS[o.dayOfWeek as number]} override`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Add override */}
        {availableDays.length > 0 && (
          <div className="flex items-end gap-3 flex-wrap">
            <div className="space-y-1.5">
              <Label className="text-xs">Add override</Label>
              <select
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
              >
                {availableDays.map((i) => (
                  <option key={i} value={i}>
                    {DAYS[i]}
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="h-9 w-36"
              aria-label="Override time"
            />
            <Button onClick={addOverride} disabled={addingOverride} size="sm" variant="outline" className="h-9">
              <Plus className="w-4 h-4 mr-1.5" />
              Add
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
