'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getHubBoardParcels,
  groupIntoBins,
  getActiveHubCheckins,
  retargetHubParcel,
  type HubBoardParcel,
  type HubCheckin,
} from '@/lib/consolidation'
import { loadAllDrivers } from '@/lib/db-extended'
import type { Driver } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select'
import {
  Boxes,
  PackageCheck,
  Truck,
  AlertTriangle,
  RefreshCw,
  MapPin,
  UserCheck,
  ArrowRightLeft,
} from 'lucide-react'

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

// Read-only hub oversight (§6). The driver scan is the source of truth: a
// parcel appears here once a pickup driver scans it INTO the hub, and it
// leaves once the destination driver scans it OUT (hub accept). Admins
// monitor and can re-target diverged parcels.
export function AdminSort() {
  const [parcels, setParcels] = useState<HubBoardParcel[]>([])
  const [checkins, setCheckins] = useState<HubCheckin[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // deliveryId -> driverId being selected for re-target
  const [retargetSelections, setRetargetSelections] = useState<Record<string, string>>({})
  const [retargeting, setRetargeting] = useState<Record<string, boolean>>({})

  const refresh = useCallback(async () => {
    const [board, present] = await Promise.all([
      getHubBoardParcels(),
      getActiveHubCheckins().catch(() => [] as HubCheckin[]),
    ])
    setParcels(board)
    setCheckins(present)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const [, , driversData] = await Promise.all([
        refresh(),
        Promise.resolve(),
        loadAllDrivers(),
      ])
      setDrivers(driversData)
    } catch (err) {
      console.log('[v0] AdminSort load failed:', (err as Error).message)
      toast.error('Failed to load the sort board')
    } finally {
      setLoading(false)
    }
  }, [refresh])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Live oversight: poll every 15s.
  useEffect(() => {
    const id = setInterval(() => {
      refresh().catch(() => {})
    }, 15_000)
    return () => clearInterval(id)
  }, [refresh])

  const bins = useMemo(() => groupIntoBins(parcels), [parcels])
  const presentDriverIds = useMemo(
    () => new Set(checkins.map((c) => c.driverId)),
    [checkins],
  )
  const divergedCount = useMemo(
    () => parcels.filter((p) => p.assignmentDiverged).length,
    [parcels],
  )

  async function handleRefresh() {
    setRefreshing(true)
    try {
      await refresh()
    } finally {
      setRefreshing(false)
    }
  }

  async function handleRetarget(parcel: HubBoardParcel) {
    const driverId = retargetSelections[parcel.deliveryId]
    if (!driverId) return
    const driver = drivers.find((d) => d.id === driverId)
    if (!driver) return
    setRetargeting((r) => ({ ...r, [parcel.deliveryId]: true }))
    try {
      await retargetHubParcel({
        deliveryId: parcel.deliveryId,
        driverId,
        driverName: driver.name,
      })
      toast.success(`Parcel re-targeted to ${driver.name}`)
      // Clear the selection and refresh the board.
      setRetargetSelections((s) => {
        const next = { ...s }
        delete next[parcel.deliveryId]
        return next
      })
      await refresh()
    } catch (err) {
      toast.error('Failed to re-target parcel')
      console.log('[v0] retarget failed:', (err as Error).message)
    } finally {
      setRetargeting((r) => ({ ...r, [parcel.deliveryId]: false }))
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Boxes className="size-6 text-primary" />
            Hub Sort
          </h1>
          <p className="text-sm text-muted-foreground">
            Live oversight of parcels waiting at the hub. Drivers scan parcels in and out. Re-target diverged parcels using the action below each row.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label="Refresh board"
        >
          <RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary stats */}
      <div className="flex flex-wrap items-center gap-3">
        <SummaryStat label="At hub" value={parcels.length} tone="text-primary" />
        <SummaryStat label="Destination bins" value={bins.length} />
        <SummaryStat label="Drivers present" value={checkins.length} tone="text-green-600" />
        {divergedCount > 0 && (
          <SummaryStat label="Need re-target" value={divergedCount} tone="text-amber-600" />
        )}
      </div>

      {/* Diverged parcels banner */}
      {divergedCount > 0 && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" />
          <span>
            <strong>{divergedCount} parcel{divergedCount !== 1 ? 's were' : ' was'} sorted for a driver whose zone has since been reassigned.</strong>{' '}
            Use the &ldquo;Re-target&rdquo; control on each affected row to move them to the correct driver&apos;s bin.
          </span>
        </div>
      )}

      {/* Drivers checked in at the hub */}
      {checkins.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-card-foreground">
            <UserCheck className="size-4 text-green-600" />
            Drivers at the hub
          </div>
          <div className="flex flex-wrap gap-2">
            {checkins.map((c) => (
              <span
                key={c.driverId}
                className="flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs text-foreground"
              >
                <span className="flex size-5 items-center justify-center rounded-full bg-green-100 text-[10px] font-semibold text-green-700">
                  {initials(c.driverName)}
                </span>
                {c.driverName ?? 'Driver'}
                {c.hubName ? <span className="text-muted-foreground">· {c.hubName}</span> : null}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Bins */}
      {bins.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border py-16 text-center">
          <PackageCheck className="size-10 text-muted-foreground" />
          <p className="font-medium text-foreground">Nothing waiting at the hub</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            Parcels appear here once a pickup driver scans them into the hub. Intra-zone deliveries skip the hub entirely.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {bins.map((bin) => {
            const driverPresent = bin.driverId ? presentDriverIds.has(bin.driverId) : false
            return (
              <div
                key={bin.zoneId ?? 'unzoned'}
                className="flex flex-col rounded-lg border border-border bg-card"
              >
                {/* Bin header */}
                <div
                  className="flex items-center justify-between gap-2 rounded-t-lg px-4 py-3"
                  style={{ backgroundColor: `${bin.zoneColor}1a` }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-3 rounded-full"
                      style={{ backgroundColor: bin.zoneColor }}
                      aria-hidden
                    />
                    <span className="font-medium text-card-foreground">{bin.zoneName}</span>
                    <Badge variant="secondary">{bin.parcels.length}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {bin.driverName ? (
                      <span className="flex items-center gap-1.5" title={bin.driverName}>
                        <span
                          className={`flex size-6 items-center justify-center rounded-full text-[10px] font-semibold ${
                            driverPresent
                              ? 'bg-green-100 text-green-700'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          {initials(bin.driverName)}
                        </span>
                        {driverPresent ? (
                          <span className="text-green-600">Here</span>
                        ) : (
                          <span className="italic">Away</span>
                        )}
                      </span>
                    ) : (
                      <span className="italic">No driver</span>
                    )}
                  </div>
                </div>

                <Separator />

                <ul className="flex flex-1 flex-col divide-y divide-border">
                  {bin.parcels.map((p) => {
                    const isRetargeting = retargeting[p.deliveryId] ?? false
                    const selectedDriverId = retargetSelections[p.deliveryId]
                    return (
                      <li key={p.deliveryId} className="flex flex-col gap-2 px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-card-foreground">
                              {p.recipientName ?? 'Recipient'}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {p.scanToken ? `${p.scanToken} · ` : ''}
                              {p.dropoffArea ?? p.dropoffAddress ?? '—'}
                            </p>
                          </div>
                          <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
                            <MapPin className="size-3" />
                            Waiting
                          </Badge>
                        </div>

                        {/* Diverged row: re-target control */}
                        {p.assignmentDiverged && (
                          <div className="rounded-md border border-amber-500/30 bg-amber-500/5 px-2.5 py-2 space-y-1.5">
                            <p className="flex items-center gap-1 text-[11px] text-amber-600 font-medium">
                              <AlertTriangle className="size-3 shrink-0" />
                              Sorted for {p.sortedForDriverName ?? 'another driver'} — zone since reassigned
                            </p>
                            <div className="flex items-center gap-1.5">
                              <Select
                                value={selectedDriverId ?? '__none__'}
                                onValueChange={(v) =>
                                  setRetargetSelections((s) => ({ ...s, [p.deliveryId]: v }))
                                }
                              >
                                <SelectTrigger className="h-7 flex-1 text-xs">
                                  {selectedDriverId
                                    ? (drivers.find((d) => d.id === selectedDriverId)?.name ?? 'Driver')
                                    : 'Select new driver'}
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__" disabled>Select new driver</SelectItem>
                                  {drivers.map((d) => (
                                    <SelectItem key={d.id} value={d.id}>
                                      {d.name}
                                      {presentDriverIds.has(d.id) ? ' · Here' : ''}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 gap-1 text-xs shrink-0 border-amber-500/40 text-amber-700 hover:bg-amber-500/10"
                                disabled={!selectedDriverId || selectedDriverId === '__none__' || isRetargeting}
                                onClick={() => handleRetarget(p)}
                              >
                                {isRetargeting
                                  ? <Spinner className="size-3" />
                                  : <ArrowRightLeft className="size-3" />}
                                Re-target
                              </Button>
                            </div>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
        <Truck className="size-4 shrink-0" />
        Parcels leave this board automatically when the destination driver scans them out of the hub.
      </div>
    </div>
  )
}

function SummaryStat({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5 rounded-lg border border-border bg-card px-3 py-2">
      <span className={`text-lg font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
