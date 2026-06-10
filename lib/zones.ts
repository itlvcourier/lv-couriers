'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID } from '@/lib/feature-settings'

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
  effectiveDate: string
  shift: string | null
  createdAt: string
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

/** The driver assigned to a zone for a given date (defaults to today). */
export async function getZoneDriver(
  zoneId: string,
  date?: string,
): Promise<string | null> {
  const supabase = createClient()
  if (!supabase) return null
  const day = date ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('zone_assignments')
    .select('driver_id')
    .eq('zone_id', zoneId)
    .eq('effective_date', day)
    .limit(1)
    .maybeSingle()
  if (error || !data) return null
  return (data as { driver_id: string }).driver_id
}

export async function getZoneAssignments(date?: string): Promise<ZoneAssignment[]> {
  const supabase = createClient()
  if (!supabase) return []
  const day = date ?? new Date().toISOString().slice(0, 10)
  const { data, error } = await supabase
    .from('zone_assignments')
    .select('id, zone_id, driver_id, effective_date, shift, created_at')
    .eq('effective_date', day)
  if (error) throw error
  return (data as Array<{
    id: string
    zone_id: string
    driver_id: string
    effective_date: string
    shift: string | null
    created_at: string
  }>).map((r) => ({
    id: r.id,
    zoneId: r.zone_id,
    driverId: r.driver_id,
    effectiveDate: r.effective_date,
    shift: r.shift,
    createdAt: r.created_at,
  }))
}

export async function assignDriverToZone(input: {
  zoneId: string
  driverId: string
  effectiveDate?: string
  shift?: string | null
}): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('zone_assignments').upsert(
    {
      org_id: ORG_ID,
      zone_id: input.zoneId,
      driver_id: input.driverId,
      effective_date: input.effectiveDate ?? new Date().toISOString().slice(0, 10),
      shift: input.shift ?? null,
    },
    { onConflict: 'org_id,zone_id,effective_date,shift' },
  )
  if (error) throw error
}

/** Remove a driver assignment for a zone on a given date. */
export async function unassignDriverFromZone(
  zoneId: string,
  date?: string,
): Promise<void> {
  const supabase = createClient()
  const day = date ?? new Date().toISOString().slice(0, 10)
  const { error } = await supabase
    .from('zone_assignments')
    .delete()
    .eq('zone_id', zoneId)
    .eq('effective_date', day)
  if (error) throw error
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
