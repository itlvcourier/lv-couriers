'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID } from '@/lib/feature-settings'

// ============================================================================
// Phase 4 — Consolidation runs + hub Sort Mode.
//
// A consolidation run is a hub "sort wave". The hub team:
//   1. opens a run,
//   2. checks parcels into it as they arrive (custody hub_in already moved
//      them to leg_status='at_hub' via the scanner),
//   3. sorts each parcel to its destination-zone bin,
//   4. hands off bins to the delivery drivers,
//   5. closes the run with a reconciliation summary.
//
// Intra-zone parcels (routing_mode='direct') never enter the hub, so they are
// excluded from the sort board and from runs by construction.
// ============================================================================

export type RunStatus = 'open' | 'sorting' | 'closed'
export type RunItemStatus = 'checked_in' | 'sorted' | 'handed_off' | 'exception'

export interface ConsolidationRun {
  id: string
  label: string
  hubName: string | null
  status: RunStatus
  openedAt: string
  closedAt: string | null
  notes: string | null
}

export interface HubBoardParcel {
  deliveryId: string
  scanToken: string | null
  recipientName: string | null
  dropoffAddress: string | null
  dropoffArea: string | null
  dropoffZoneId: string | null
  zoneName: string | null
  zoneColor: string | null
  zoneDriverId: string | null
  zoneDriverName: string | null
  legStatus: string | null
  routingMode: string | null
  updatedAt: string | null
  /** Destination driver snapshotted at sort time (§6). */
  sortedForDriverId: string | null
  sortedForDriverName: string | null
  /** True when today's live zone driver differs from the snapshot. */
  assignmentDiverged: boolean
}

/** A driver currently checked in at the hub. */
export interface HubCheckin {
  driverId: string
  driverName: string | null
  hubName: string | null
  checkedInAt: string
  lastSeenAt: string
}

/** A destination-zone bin with the parcels sorted into it. */
export interface HubBin {
  zoneId: string | null
  zoneName: string
  zoneColor: string
  driverId: string | null
  driverName: string | null
  parcels: HubBoardParcel[]
}

export interface RunReconciliation {
  expected: number
  checkedIn: number
  sorted: number
  handedOff: number
  exceptions: number
}

type RunRow = {
  id: string
  label: string
  hub_name: string | null
  status: RunStatus
  opened_at: string
  closed_at: string | null
  notes: string | null
}

function mapRun(r: RunRow): ConsolidationRun {
  return {
    id: r.id,
    label: r.label,
    hubName: r.hub_name,
    status: r.status,
    openedAt: r.opened_at,
    closedAt: r.closed_at,
    notes: r.notes,
  }
}

const RUN_COLUMNS = 'id, label, hub_name, status, opened_at, closed_at, notes'

// ---------------------------------------------------------------------------
// Runs
// ---------------------------------------------------------------------------

/** The currently open/sorting run, if any (most recent). */
export async function getActiveRun(): Promise<ConsolidationRun | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('consolidation_runs')
    .select(RUN_COLUMNS)
    .in('status', ['open', 'sorting'])
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? mapRun(data as RunRow) : null
}

export async function listRuns(limit = 20): Promise<ConsolidationRun[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('consolidation_runs')
    .select(RUN_COLUMNS)
    .order('opened_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as RunRow[]).map(mapRun)
}

export async function openRun(input: {
  label?: string
  hubName?: string | null
  openedBy?: string | null
}): Promise<ConsolidationRun> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const label =
    input.label?.trim() ||
    `Sort wave ${new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}`
  const { data, error } = await supabase
    .from('consolidation_runs')
    .insert({
      org_id: ORG_ID,
      label,
      hub_name: input.hubName ?? null,
      opened_by: input.openedBy ?? null,
      status: 'open',
    })
    .select(RUN_COLUMNS)
    .single()
  if (error) throw error
  return mapRun(data as RunRow)
}

export async function setRunStatus(runId: string, status: RunStatus): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const patch: Record<string, unknown> = { status }
  if (status === 'closed') patch.closed_at = new Date().toISOString()
  const { error } = await supabase.from('consolidation_runs').update(patch).eq('id', runId)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Run membership / sorting
// ---------------------------------------------------------------------------

/**
 * Add an at-hub parcel to a run (idempotent on run_id+delivery_id). The bin
 * defaults to the destination zone name so the board can group by bin.
 */
export async function addParcelToRun(input: {
  runId: string
  deliveryId: string
  dropoffZoneId: string | null
  bin?: string | null
}): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const { error } = await supabase.from('consolidation_run_items').upsert(
    {
      org_id: ORG_ID,
      run_id: input.runId,
      delivery_id: input.deliveryId,
      dropoff_zone_id: input.dropoffZoneId,
      bin: input.bin ?? null,
      status: 'checked_in',
    },
    { onConflict: 'run_id,delivery_id' },
  )
  if (error) throw error
}

export async function setRunItemStatus(input: {
  runId: string
  deliveryId: string
  status: RunItemStatus
}): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const patch: Record<string, unknown> = { status: input.status }
  if (input.status === 'sorted') patch.sorted_at = new Date().toISOString()
  if (input.status === 'handed_off') patch.handed_off_at = new Date().toISOString()
  const { error } = await supabase
    .from('consolidation_run_items')
    .update(patch)
    .eq('run_id', input.runId)
    .eq('delivery_id', input.deliveryId)
  if (error) throw error
}

/** Delivery ids already in a run, keyed by their item status. */
export async function getRunItemStatuses(
  runId: string,
): Promise<Record<string, RunItemStatus>> {
  const supabase = createClient()
  if (!supabase) return {}
  const { data, error } = await supabase
    .from('consolidation_run_items')
    .select('delivery_id, status')
    .eq('run_id', runId)
  if (error) throw error
  const out: Record<string, RunItemStatus> = {}
  for (const row of (data as Array<{ delivery_id: string; status: RunItemStatus }>)) {
    out[row.delivery_id] = row.status
  }
  return out
}

// ---------------------------------------------------------------------------
// Hub sort board (live) + reconciliation
// ---------------------------------------------------------------------------

type BoardRow = {
  delivery_id: string
  scan_token: string | null
  recipient_name: string | null
  dropoff_address: string | null
  dropoff_area: string | null
  dropoff_zone_id: string | null
  zone_name: string | null
  zone_color: string | null
  zone_driver_id: string | null
  zone_driver_name: string | null
  leg_status: string | null
  routing_mode: string | null
  updated_at: string | null
  sorted_for_driver_id: string | null
  sorted_for_driver_name: string | null
  assignment_diverged: boolean | null
}

function mapBoardRow(r: BoardRow): HubBoardParcel {
  return {
    deliveryId: r.delivery_id,
    scanToken: r.scan_token,
    recipientName: r.recipient_name,
    dropoffAddress: r.dropoff_address,
    dropoffArea: r.dropoff_area,
    dropoffZoneId: r.dropoff_zone_id,
    zoneName: r.zone_name,
    zoneColor: r.zone_color,
    zoneDriverId: r.zone_driver_id,
    zoneDriverName: r.zone_driver_name,
    legStatus: r.leg_status,
    routingMode: r.routing_mode,
    updatedAt: r.updated_at,
    sortedForDriverId: r.sorted_for_driver_id,
    sortedForDriverName: r.sorted_for_driver_name,
    assignmentDiverged: Boolean(r.assignment_diverged),
  }
}

// ---------------------------------------------------------------------------
// Hub check-ins (§6): which drivers are physically present at the hub.
// ---------------------------------------------------------------------------

/** Record/refresh the current driver's hub check-in. */
export async function recordHubCheckin(input: {
  driverId: string
  hubName?: string | null
  lat?: number | null
  lng?: number | null
}): Promise<void> {
  const supabase = createClient()
  if (!supabase) return
  const { error } = await supabase.rpc('record_hub_checkin', {
    p_driver_id: input.driverId,
    p_hub_name: input.hubName ?? null,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
  })
  if (error) throw error
}

/** Drivers currently checked in at the hub (admin oversight). */
export async function getActiveHubCheckins(): Promise<HubCheckin[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('active_hub_checkins')
  if (error) throw error
  return (data as Array<{
    driver_id: string
    driver_name: string | null
    hub_name: string | null
    checked_in_at: string
    last_seen_at: string
  }>).map((r) => ({
    driverId: r.driver_id,
    driverName: r.driver_name,
    hubName: r.hub_name,
    checkedInAt: r.checked_in_at,
    lastSeenAt: r.last_seen_at,
  }))
}

/** All parcels currently at the hub, mapped to UI shape. */
export async function getHubBoardParcels(): Promise<HubBoardParcel[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('hub_sort_board')
  if (error) throw error
  return (data as BoardRow[]).map(mapBoardRow)
}

/** Group at-hub parcels into destination-zone bins. */
export function groupIntoBins(parcels: HubBoardParcel[]): HubBin[] {
  const bins = new Map<string, HubBin>()
  for (const p of parcels) {
    const key = p.dropoffZoneId ?? '__unzoned__'
    let bin = bins.get(key)
    if (!bin) {
      bin = {
        zoneId: p.dropoffZoneId,
        zoneName: p.zoneName ?? 'Unzoned',
        zoneColor: p.zoneColor ?? '#64748b',
        driverId: p.zoneDriverId,
        driverName: p.zoneDriverName,
        parcels: [],
      }
      bins.set(key, bin)
    }
    bin.parcels.push(p)
  }
  // Unzoned bin last; otherwise keep insertion order (already zone-prioritized).
  return Array.from(bins.values()).sort((a, b) => {
    if (a.zoneId === null) return 1
    if (b.zoneId === null) return -1
    return 0
  })
}

export async function reconcileRun(runId: string): Promise<RunReconciliation> {
  const supabase = createClient()
  if (!supabase) return { expected: 0, checkedIn: 0, sorted: 0, handedOff: 0, exceptions: 0 }
  const { data, error } = await supabase.rpc('consolidation_reconcile', { p_run_id: runId })
  if (error) throw error
  const row = (data as Array<{
    expected: number
    checked_in: number
    sorted: number
    handed_off: number
    exceptions: number
  }>)[0]
  return {
    expected: Number(row?.expected ?? 0),
    checkedIn: Number(row?.checked_in ?? 0),
    sorted: Number(row?.sorted ?? 0),
    handedOff: Number(row?.handed_off ?? 0),
    exceptions: Number(row?.exceptions ?? 0),
  }
}
