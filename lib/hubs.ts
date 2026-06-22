'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID } from '@/lib/feature-settings'

// ============================================================================
// Hubs: the physical cross-dock meet/sort points. A cross-dock parcel is
// carried by its pickup driver to a hub, sorted into a destination-zone bin,
// and collected by the delivery driver. Backed by the `hubs` table and
// referenced from `deliveries.hub_id`.
// ============================================================================

export interface Hub {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  /** Daily sort/meet time in "HH:MM" form (null when unscheduled). */
  sortTime: string | null
  isDefault: boolean
  isActive: boolean
  createdAt: string
}

type HubRow = {
  id: string
  name: string
  address: string | null
  lat: number | null
  lng: number | null
  sort_time: string | null
  is_default: boolean
  is_active: boolean
  created_at: string
}

/** Normalise a Postgres `time` value ("HH:MM:SS") down to "HH:MM". */
function normalizeTime(t: string | null): string | null {
  if (!t) return null
  const m = /^(\d{2}):(\d{2})/.exec(t)
  return m ? `${m[1]}:${m[2]}` : t
}

function mapHub(r: HubRow): Hub {
  return {
    id: r.id,
    name: r.name,
    address: r.address,
    lat: r.lat,
    lng: r.lng,
    sortTime: normalizeTime(r.sort_time),
    isDefault: r.is_default,
    isActive: r.is_active,
    createdAt: r.created_at,
  }
}

const HUB_COLS =
  'id, name, address, lat, lng, sort_time, is_default, is_active, created_at'

/** All hubs (optionally including inactive), default first then by name. */
export async function getHubs(includeInactive = true): Promise<Hub[]> {
  const supabase = createClient()
  if (!supabase) return []
  let query = supabase
    .from('hubs')
    .select(HUB_COLS)
    .order('is_default', { ascending: false })
    .order('name', { ascending: true })
  if (!includeInactive) query = query.eq('is_active', true)
  const { data, error } = await query
  if (error) throw error
  return (data as HubRow[]).map(mapHub)
}

/** Active hubs only — what drivers should ever be routed to. */
export async function getActiveHubs(): Promise<Hub[]> {
  return getHubs(false)
}

/**
 * The org's default hub (used for cross-dock routing). Falls back to the first
 * active hub when no explicit default is set, or null when there are none.
 */
export async function getDefaultHub(): Promise<Hub | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('hubs')
    .select(HUB_COLS)
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) {
    console.log('[v0] getDefaultHub failed:', error.message)
    return null
  }
  return data ? mapHub(data as HubRow) : null
}

export async function createHub(input: {
  name: string
  address?: string | null
  lat?: number | null
  lng?: number | null
  sortTime?: string | null
  isDefault?: boolean
}): Promise<Hub> {
  const supabase = createClient()
  // A new default must clear any existing default first (single-default index).
  if (input.isDefault) await clearDefaultHub()
  const { data, error } = await supabase
    .from('hubs')
    .insert({
      org_id: ORG_ID,
      name: input.name,
      address: input.address ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      sort_time: input.sortTime || null,
      is_default: input.isDefault ?? false,
      is_active: true,
    })
    .select(HUB_COLS)
    .single()
  if (error) throw error
  return mapHub(data as HubRow)
}

export async function updateHub(
  hubId: string,
  patch: Partial<{
    name: string
    address: string | null
    lat: number | null
    lng: number | null
    sortTime: string | null
    isActive: boolean
  }>,
): Promise<void> {
  const supabase = createClient()
  const row: Record<string, unknown> = {}
  if (patch.name !== undefined) row.name = patch.name
  if (patch.address !== undefined) row.address = patch.address
  if (patch.lat !== undefined) row.lat = patch.lat
  if (patch.lng !== undefined) row.lng = patch.lng
  if (patch.sortTime !== undefined) row.sort_time = patch.sortTime || null
  if (patch.isActive !== undefined) row.is_active = patch.isActive
  if (Object.keys(row).length === 0) return
  const { error } = await supabase.from('hubs').update(row).eq('id', hubId)
  if (error) throw error
}

export async function deleteHub(hubId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('hubs').delete().eq('id', hubId)
  if (error) throw error
}

/** Clear the default flag on every hub (used before setting a new default). */
async function clearDefaultHub(): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase
    .from('hubs')
    .update({ is_default: false })
    .eq('is_default', true)
  if (error) throw error
}

/** Make one hub the sole default for the org. */
export async function setDefaultHub(hubId: string): Promise<void> {
  await clearDefaultHub()
  const supabase = createClient()
  const { error } = await supabase
    .from('hubs')
    .update({ is_default: true, is_active: true })
    .eq('id', hubId)
  if (error) throw error
}
