'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getActiveRun,
  openRun,
  setRunStatus,
  addParcelToRun,
  setRunItemStatus,
  getRunItemStatuses,
  getHubBoardParcels,
  groupIntoBins,
  reconcileRun,
  type ConsolidationRun,
  type HubBoardParcel,
  type RunItemStatus,
  type RunReconciliation,
} from '@/lib/consolidation'
import { recordCustodyEvent } from '@/lib/custody'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Separator } from '@/components/ui/separator'
import {
  Boxes,
  PackageCheck,
  CheckCircle2,
  PlayCircle,
  Lock,
  Truck,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'

function initials(name: string | null): string {
  if (!name) return '?'
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')
}

export function AdminSort() {
  const { currentUser } = useApp()
  const [run, setRun] = useState<ConsolidationRun | null>(null)
  const [parcels, setParcels] = useState<HubBoardParcel[]>([])
  const [itemStatuses, setItemStatuses] = useState<Record<string, RunItemStatus>>({})
  const [recon, setRecon] = useState<RunReconciliation | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [working, setWorking] = useState(false)

  const refresh = useCallback(async (runId: string | null) => {
    const [board, statuses, rec] = await Promise.all([
      getHubBoardParcels(),
      runId ? getRunItemStatuses(runId) : Promise.resolve({}),
      runId ? reconcileRun(runId) : Promise.resolve(null),
    ])
    setParcels(board)
    setItemStatuses(statuses)
    setRecon(rec)
  }, [])

  const loadAll = useCallback(async () => {
    try {
      const active = await getActiveRun()
      setRun(active)
      await refresh(active?.id ?? null)
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

  // Live refresh of the board every 15s while a run is active.
  useEffect(() => {
    if (!run) return
    const id = setInterval(() => {
      refresh(run.id).catch(() => {})
    }, 15_000)
    return () => clearInterval(id)
  }, [run, refresh])

  const bins = useMemo(() => groupIntoBins(parcels), [parcels])

  async function handleOpenRun() {
    setWorking(true)
    try {
      const r = await openRun({ openedBy: currentUser?.id ?? null })
      setRun(r)
      await refresh(r.id)
      toast.success('Sort wave opened')
    } catch (err) {
      console.log('[v0] openRun failed:', (err as Error).message)
      toast.error('Could not open a sort wave')
    } finally {
      setWorking(false)
    }
  }

  async function handleCloseRun() {
    if (!run) return
    setWorking(true)
    try {
      await setRunStatus(run.id, 'closed')
      toast.success('Sort wave closed')
      setRun(null)
      setRecon(null)
      setItemStatuses({})
    } catch (err) {
      console.log('[v0] closeRun failed:', (err as Error).message)
      toast.error('Could not close the sort wave')
    } finally {
      setWorking(false)
    }
  }

  // Mark a parcel sorted into its destination bin (adds to the run if needed).
  async function handleSort(p: HubBoardParcel) {
    if (!run) {
      toast.error('Open a sort wave first')
      return
    }
    setBusyId(p.deliveryId)
    try {
      await addParcelToRun({
        runId: run.id,
        deliveryId: p.deliveryId,
        dropoffZoneId: p.dropoffZoneId,
        bin: p.zoneName,
      })
      await setRunItemStatus({ runId: run.id, deliveryId: p.deliveryId, status: 'sorted' })
      if (run.status === 'open') {
        await setRunStatus(run.id, 'sorting')
        setRun({ ...run, status: 'sorting' })
      }
      await refresh(run.id)
    } catch (err) {
      console.log('[v0] sort failed:', (err as Error).message)
      toast.error('Could not sort that parcel')
    } finally {
      setBusyId(null)
    }
  }

  // Hand a sorted parcel off to the zone's delivery driver: records the handoff
  // custody event (advances leg to out_for_delivery) and updates run item.
  async function handleHandoff(p: HubBoardParcel) {
    if (!run) return
    setBusyId(p.deliveryId)
    try {
      await recordCustodyEvent({
        deliveryId: p.deliveryId,
        eventType: 'handoff',
        actorType: 'admin',
        actorId: currentUser?.id ?? null,
        toHolder: p.zoneDriverId ? `driver:${p.zoneDriverId}` : null,
        scanMethod: 'manual',
        notes: `Hub handoff to ${p.zoneDriverName ?? 'zone driver'}`,
        metadata: { runId: run.id, source: 'sort_board' },
      })
      await setRunItemStatus({ runId: run.id, deliveryId: p.deliveryId, status: 'handed_off' })
      await refresh(run.id)
      toast.success(`Handed off to ${p.zoneDriverName ?? 'driver'}`)
    } catch (err) {
      console.log('[v0] handoff failed:', (err as Error).message)
      toast.error('Could not record the handoff')
    } finally {
      setBusyId(null)
    }
  }

  async function handleHandoffBin(parcels: HubBoardParcel[]) {
    const sorted = parcels.filter((p) => itemStatuses[p.deliveryId] === 'sorted')
    for (const p of sorted) {
      // eslint-disable-next-line no-await-in-loop
      await handleHandoff(p)
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
      {/* Header / run controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
            <Boxes className="size-6 text-primary" />
            Hub Sort
          </h1>
          <p className="text-sm text-muted-foreground">
            Sort consolidated parcels into destination-zone bins and hand them off to delivery drivers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refresh(run?.id ?? null)}
            aria-label="Refresh board"
          >
            <RefreshCw className="size-4" />
            Refresh
          </Button>
          {run ? (
            <Button variant="destructive" size="sm" onClick={handleCloseRun} disabled={working}>
              <Lock className="size-4" />
              Close wave
            </Button>
          ) : (
            <Button size="sm" onClick={handleOpenRun} disabled={working}>
              <PlayCircle className="size-4" />
              Open sort wave
            </Button>
          )}
        </div>
      </div>

      {/* Active run + reconciliation summary */}
      {run && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="font-medium text-card-foreground">{run.label}</span>
              <Badge variant={run.status === 'sorting' ? 'default' : 'secondary'} className="capitalize">
                {run.status}
              </Badge>
            </div>
            {recon && (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <ReconStat label="Expected" value={recon.expected} />
                <ReconStat label="Sorted" value={recon.sorted} tone="text-primary" />
                <ReconStat label="Handed off" value={recon.handedOff} tone="text-green-600" />
                {recon.exceptions > 0 && (
                  <ReconStat label="Exceptions" value={recon.exceptions} tone="text-destructive" />
                )}
              </div>
            )}
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
            const sortedCount = bin.parcels.filter(
              (p) => itemStatuses[p.deliveryId] === 'sorted',
            ).length
            return (
              <div
                key={bin.zoneId ?? 'unzoned'}
                className="flex flex-col rounded-lg border border-border bg-card"
              >
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
                      <span
                        className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-foreground"
                        title={bin.driverName}
                      >
                        {initials(bin.driverName)}
                      </span>
                    ) : (
                      <span className="italic">No driver</span>
                    )}
                  </div>
                </div>

                <Separator />

                <ul className="flex flex-1 flex-col divide-y divide-border">
                  {bin.parcels.map((p) => {
                    const st = itemStatuses[p.deliveryId]
                    return (
                      <li key={p.deliveryId} className="flex items-center gap-3 px-4 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-card-foreground">
                            {p.recipientName ?? 'Recipient'}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {p.scanToken ? `${p.scanToken} · ` : ''}
                            {p.dropoffArea ?? p.dropoffAddress ?? '—'}
                          </p>
                        </div>
                        {st === 'handed_off' ? (
                          <Badge variant="outline" className="gap-1 text-green-600">
                            <Truck className="size-3" />
                            Out
                          </Badge>
                        ) : st === 'sorted' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busyId === p.deliveryId}
                            onClick={() => handleHandoff(p)}
                          >
                            {busyId === p.deliveryId ? (
                              <Spinner className="size-3" />
                            ) : (
                              <Truck className="size-3" />
                            )}
                            Hand off
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled={busyId === p.deliveryId}
                            onClick={() => handleSort(p)}
                          >
                            {busyId === p.deliveryId ? (
                              <Spinner className="size-3" />
                            ) : (
                              <CheckCircle2 className="size-3" />
                            )}
                            Sort
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>

                {sortedCount > 0 && (
                  <div className="border-t border-border p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full"
                      onClick={() => handleHandoffBin(bin.parcels)}
                    >
                      <Truck className="size-4" />
                      Hand off {sortedCount} sorted
                    </Button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {!run && bins.length > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="size-4 shrink-0" />
          Parcels are waiting at the hub. Open a sort wave to start sorting and tracking reconciliation.
        </div>
      )}
    </div>
  )
}

function ReconStat({
  label,
  value,
  tone = 'text-foreground',
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className={`text-lg font-semibold ${tone}`}>{value}</span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  )
}
