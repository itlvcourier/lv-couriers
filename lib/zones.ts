'use client'

import { createClient } from '@/lib/supabase/client'
import {
  ORG_ID,
  getFeatureSettings,
  type ZoneRoutingStrategy,
} from '@/lib/feature-settings'

// ============================================================================
// Zones: territories used to auto-assign drivers and decide consolidation.
// Backed by `zones`, `zone_assignments`, and the SQL `resolve_zone()` fn.
// ============================================================================

export interface Zone {
  id: string
  name: string
  color: string
  fsaCodes: string[]
  /** GeoJSON polygon coordinates (null when zone is FSA-only). */
  geom: unknown | null
  priority: number
  isActive: boolean
  createdAt: string
}

export interface ZoneAssignment {
  id: string
  zoneId: string
  driverId: string
  /** NULL for standing assignments (apply every day until changed). */
  effectiveDate: string | null
  shift: string | null
  isPrimary: boolean
  createdAt: string
}

/** A driver assigned to a zone, with their primary flag. */
export interface ZoneDriver {
  driverId: string
  isPrimary: boolean
}

type ZoneRow = {
  id: string
  name: string
  color: string
  fsa_codes: string[] | null
  geom: unknown | null
  priority: number
  is_active: boolean
  created_at: string
}

function mapZone(r: ZoneRow): Zone {
  return {
    id: r.id,
    name: r.name,
    color: r.color,
    fsaCodes: r.fsa_codes ?? [],
    geom: r.geom ?? null,
    priority: r.priority,
    isActive: r.is_active,
    createdAt: r.created_at,
  }
}

export async function getZones(includeInactive = false): Promise<Zone[]> {
  const supabase = createClient()
  if (!supabase) return []
  let query = supabase
    .from('zones')
    .select('id, name, color, fsa_codes, geom, priority, is_active, created_at')
    .order('priority', { ascending: false })
    .order('name', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data as ZoneRow[]).map(mapZone)
}

export async function createZone(input: {
  name: string
  color?: string
  fsaCodes?: string[]
  geom?: unknown | null
  priority?: number
}): Promise<Zone> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('zones')
    .insert({
      org_id: ORG_ID,
      name: input.name,
      color: input.color ?? '#6b7280',
      fsa_codes: input.fsaCodes ?? [],
      geom: input.geom ?? null,
      priority: input.priority ?? 0,
      is_active: true,
    })
    .select('id, name, color, fsa_codes, geom, priority, is_active, created_at')
    .single()
  if (error) throw error
  return mapZone(data as ZoneRow)
}

export async function updateZone(
  zoneId: string,
  patch: Partial<{
    name: string
    color: string
    fsaCodes: string[]
    geom: unknown | null
    priority: number
    isActive: boolean
  }>,
): Promise<void> {
  const supabase = createClient()
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.color !== undefined) row.color = patch.color
  if (patch.fsaCodes !== undefined) row.fsa_codes = patch.fsaCodes
  if (patch.geom !== undefined) row.geom = patch.geom
  if (patch.priority !== undefined) row.priority = patch.priority
  if (patch.isActive !== undefined) row.is_active = patch.isActive
  const { error } = await supabase.from('zones').update(row).eq('id', zoneId)
  if (error) throw error
}

/**
 * Resolve a point (and/or postal code) to a zone id using the PostGIS-backed
 * SQL function: polygon containment first, FSA-prefix fallback second.
 */
export async function resolveZoneForPoint(
  lat: number | null | undefined,
  lng: number | null | undefined,
  postal?: string | null,
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase.rpc('resolve_zone', {
    p_lat: lat ?? null,
    p_lng: lng ?? null,
    p_postal: postal ?? null,
  })
  if (error) {
    console.log('[v0] resolve_zone failed:', error.message)
    return null
  }
  return (data as string | null) ?? null
}

/**
 * All drivers with a standing assignment to a zone (primary listed first).
 * Standing assignments have effective_date IS NULL.
 */
export async function getZoneDrivers(zoneId: string): Promise<ZoneDriver[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('zone_assignments')
    .select('driver_id, is_primary')
    .eq('zone_id', zoneId)
    .is('effective_date', null)
    .order('is_primary', { ascending: false })
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return (data as Array<{ driver_id: string; is_primary: boolean }>).map((r) => ({
    driverId: r.driver_id,
    isPrimary: r.is_primary,
  }))
}

/**
 * Back-compat single-driver accessor: returns the zone's primary driver, or the
 * first assigned driver when no primary is set. New routing should use
 * pickZoneDriver(), which honours the configured multi-driver strategy.
 */
export async function getZoneDriver(zoneId: string): Promise<string | null> {
  const drivers = await getZoneDrivers(zoneId)
  if (drivers.length === 0) return null
  const primary = drivers.find((d) => d.isPrimary)
  return (primary ?? drivers[0]).driverId
}

/** All standing zone assignments across every zone. */
export async function getZoneAssignments(): Promise<ZoneAssignment[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('zone_assignments')
    .select('id, zone_id, driver_id, effective_date, shift, is_primary, created_at')
    .is('effective_date', null)
  if (error) throw error
  return (data as Array<{
    id: string
    zone_id: string
    driver_id: string
    effective_date: string | null
    shift: string | null
    is_primary: boolean
    created_at: string
  }>).map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    driverId: r.driver_id,
    effectiveDate: r.effective_date,
    shift: r.shift,
    isPrimary: r.is_primary,
    createdAt: r.created_at,
  }))
}

/**
 * Add a standing driver assignment to a zone. Idempotent: re-adding an existing
 * driver is a no-op (the partial unique index prevents duplicates).
 */
export async function assignDriverToZone(input: {
  zoneId: string
  driverId: string
  isPrimary?: boolean
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('zone_assignments').upsert(
    {
      org_id: ORG_ID,
      zone_id: input.zoneId,
      driver_id: input.driverId,
      effective_date: null,
      shift: null,
      is_primary: input.isPrimary ?? false,
    },
    { onConflict: 'org_id,zone_id,driver_id', ignoreDuplicates: true },
  )
  if (error) throw error
}

/** Remove a single driver's standing assignment from a zone. */
export async function unassignDriverFromZone(
  zoneId: string,
  driverId: string,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('zone_assignments')
    .delete()
    .eq('zone_id', zoneId)
    .eq('driver_id', driverId)
    .is('effective_date', null)
  if (error) throw error
}

/**
 * Mark one driver as the zone's primary (and clear the flag on the others).
 * Pass driverId=null to clear the primary entirely.
 */
export async function setPrimaryZoneDriver(
  zoneId: string,
  driverId: string | null,
): Promise<void> {
  const supabase = createClient()
  // Clear existing primary on this zone's standing assignments.
  const { error: clearErr } = await supabase
    .from('zone_assignments')
    .update({ is_primary: false })
    .eq('zone_id', zoneId)
    .is('effective_date', null)
    .eq('is_primary', true)
  if (clearErr) throw clearErr
  if (!driverId) return
  const { error } = await supabase
    .from('zone_assignments')
    .update({ is_primary: true })
    .eq('zone_id', zoneId)
    .eq('driver_id', driverId)
    .is('effective_date', null)
  if (error) throw error
}

/**
 * Choose which driver should receive a parcel for a zone, honouring the
 * configured multi-driver routing strategy. Returns null when the zone has no
 * driver, or when the strategy is "pool" (parcels are left claimable).
 *
 * Single-driver zones return that driver under every strategy.
 */
export async function pickZoneDriver(
  zoneId: string,
  opts?: {
    strategy?: ZoneRoutingStrategy
    pickupLat?: number | null
    pickupLng?: number | null
  },
): Promise<string | null> {
  const drivers = await getZoneDrivers(zoneId)
  if (drivers.length === 0) return null
  if (drivers.length === 1) return drivers[0].driverId

  const strategy =
    opts?.strategy ?? (await getFeatureSettings()).zone_routing_strategy

  switch (strategy) {
    case 'pool':
      // Don't auto-assign; the parcel stays claimable by any zone driver.
      return null
    case 'primary': {
      const primary = drivers.find((d) => d.isPrimary)
      return (primary ?? drivers[0]).driverId
    }
    case 'nearest': {
      const id = await pickNearestDriver(
        drivers.map((d) => d.driverId),
        opts?.pickupLat ?? null,
        opts?.pickupLng ?? null,
      )
      // Fall back to load-balancing when we have no usable coordinates.
      return id ?? (await pickLeastLoadedDriver(drivers.map((d) => d.driverId)))
    }
    case 'balanced':
    default:
      return pickLeastLoadedDriver(drivers.map((d) => d.driverId))
  }
}

/** The driver among the candidates with the fewest currently-active parcels. */
async function pickLeastLoadedDriver(driverIds: string[]): Promise<string | null> {
  if (driverIds.length === 0) return null
  const supabase = createClient()
  if (!supabase) return driverIds[0]
  // Count deliveries still in an active (not delivered/cancelled) state.
  const { data, error } = await supabase
    .from('deliveries')
    .select('driver_id')
    .in('driver_id', driverIds)
    .not('status', 'in', '(delivered,cancelled)')
  if (error || !data) return driverIds[0]
  const counts = new Map<string, number>(driverIds.map((id) => [id, 0]))
  for (const row of data as Array<{ driver_id: string | null }>) {
    const id = row.driver_id
    if (id && counts.has(id)) counts.set(id, (counts.get(id) ?? 0) + 1)
  }
  // Lowest count wins; ties resolve to the earliest candidate (stable).
  let best = driverIds[0]
  let bestCount = counts.get(best) ?? 0
  for (const id of driverIds) {
    const c = counts.get(id) ?? 0
    if (c < bestCount) {
      best = id
      bestCount = c
    }
  }
  return best
}

/** The candidate driver whose last known location is closest to the pickup. */
async function pickNearestDriver(
  driverIds: string[],
  lat: number | null,
  lng: number | null,
): Promise<string | null> {
  if (driverIds.length === 0) return null
  if (lat == null || lng == null) return null
  const supabase = createClient()
  if (!supabase) return null
  // Latest location per driver among the candidates.
  const { data, error } = await supabase
    .from('driver_locations')
    .select('driver_id, lat, lng, recorded_at')
    .in('driver_id', driverIds)
    .order('recorded_at', { ascending: false })
  if (error || !data || data.length === 0) return null
  const latest = new Map<string, { lat: number; lng: number }>()
  for (const row of data as Array<{
    driver_id: string
    lat: number
    lng: number
  }>) {
    if (!latest.has(row.driver_id)) {
      latest.set(row.driver_id, { lat: row.lat, lng: row.lng })
    }
  }
  let best: string | null = null
  let bestDist = Infinity
  for (const id of driverIds) {
    const loc = latest.get(id)
    if (!loc) continue
    const d = haversineKm(lat, lng, loc.lat, loc.lng)
    if (d < bestDist) {
      bestDist = d
      best = id
    }
  }
  return best
}

/** Great-circle distance between two lat/lng points, in kilometres. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// ============================================================================
// Visual zone manager (Phase 3): GeoJSON polygons + live parcel counts.
// Backed by the SQL RPCs zones_geojson(), upsert_zone_geom(), and
// zone_parcel_counts(). Polygons round-trip through GeoJSON because PostGIS
// geometry columns are not directly writable via PostgREST.
// ============================================================================

/** GeoJSON Polygon geometry: { type:'Polygon', coordinates:[[ [lng,lat], ... ]] } */
export type GeoJSONPolygon = {
  type: 'Polygon'
  coordinates: number[][][]
}

export interface ZoneWithGeo extends Zone {
  /** Parsed GeoJSON polygon (null when the zone is FSA-only). */
  polygon: GeoJSONPolygon | null
}

type ZoneGeoRow = {
  id: string
  name: string
  color: string
  fsa_codes: string[] | null
  priority: number
  is_active: boolean
  created_at: string
  geojson: string | null
}

/** List all zones (active + inactive) with geometry parsed as GeoJSON. */
export async function getZonesWithGeo(): Promise<ZoneWithGeo[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase.rpc('zones_geojson')
  if (error) throw error
  return (data as ZoneGeoRow[]).map((r) => {
    let polygon: GeoJSONPolygon | null = null
    if (r.geojson) {
      try {
        const parsed = JSON.parse(r.geojson) as GeoJSONPolygon
        if (parsed && parsed.type === 'Polygon') polygon = parsed
      } catch {
        polygon = null
      }
    }
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      fsaCodes: r.fsa_codes ?? [],
      geom: polygon,
      priority: r.priority,
      isActive: r.is_active,
      createdAt: r.created_at,
      polygon,
    }
  })
}

/** Set (or clear) a zone's polygon from a GeoJSON geometry. Pass null to clear. */
export async function setZonePolygon(
  zoneId: string,
  polygon: GeoJSONPolygon | null,
): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc('upsert_zone_geom', {
    p_zone_id: zoneId,
    p_geojson: polygon ? JSON.stringify(polygon) : null,
  })
  if (error) throw error
}

/** Live active-parcel counts keyed by zone id (dropoff zone, non-terminal). */
export async function getZoneParcelCounts(): Promise<Record<string, number>> {
  const supabase = createClient()
  if (!supabase) return {}
  const { data, error } = await supabase.rpc('zone_parcel_counts')
  if (error) throw error
  const out: Record<string, number> = {}
  for (const row of (data as Array<{ zone_id: string; parcel_count: number }>)) {
    out[row.zone_id] = Number(row.parcel_count) || 0
  }
  return out
}
