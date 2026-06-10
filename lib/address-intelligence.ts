'use client'

import { createClient } from '@/lib/supabase/client'
import { resolveZoneForPoint } from '@/lib/zones'
import type { GeocodeConfidence, AddressValidationResult } from '@/lib/google-maps'

// ============================================================================
// Phase 6 — Address intelligence
// Validation, the driver "update address" flow, and address history.
// Backed by the `address_history` table + `apply_address_change()` RPC.
// ============================================================================

export type AddressChangeSource =
  | 'business_sms'
  | 'recipient_sms'
  | 'phoned'
  | 'pin_drop'
  | 'autocomplete'

export interface AddressHistoryEntry {
  id: string
  deliveryId: string
  oldAddress: string | null
  newAddress: string | null
  oldArea: string | null
  newArea: string | null
  oldZoneId: string | null
  newZoneId: string | null
  distanceDeltaM: number | null
  source: string | null
  geocodeConfidence: string | null
  evidencePhotoUrl: string | null
  actorType: string
  createdAt: string
}

export interface ApplyAddressChangeInput {
  deliveryId: string
  newAddress: string
  newArea?: string | null
  newPostal?: string | null
  newLat: number | null
  newLng: number | null
  /** Optional pre-resolved zone; when omitted we resolve via PostGIS. */
  newZoneId?: string | null
  geocodeConfidence: GeocodeConfidence
  source: AddressChangeSource
  evidencePhotoUrl?: string | null
  changedBy?: string | null
  actorType?: 'driver' | 'admin' | 'system'
}

/**
 * Call the server-side Google Address Validation endpoint and return the
 * normalized result (confidence level, coordinates, issues).
 */
export async function validateAddressRemote(
  address: string,
): Promise<AddressValidationResult | null> {
  try {
    const res = await fetch('/api/delivery/validate-address', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    if (!res.ok) {
      console.log('[v0] validateAddressRemote non-ok:', res.status)
      return null
    }
    return (await res.json()) as AddressValidationResult
  } catch (error) {
    console.log('[v0] validateAddressRemote error:', error)
    return null
  }
}

/**
 * Apply an address change to a delivery. Resolves the destination zone from the
 * new pin (PostGIS containment → FSA fallback) when one isn't supplied, then
 * calls apply_address_change() which atomically updates the delivery, writes an
 * address_history row, and appends an address_change custody event.
 * Returns the new address_history id.
 */
export async function applyAddressChange(
  input: ApplyAddressChangeInput,
): Promise<string> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')

  let zoneId = input.newZoneId ?? null
  if (zoneId === null || zoneId === undefined) {
    zoneId = await resolveZoneForPoint(input.newLat, input.newLng, input.newPostal)
  }

  const { data, error } = await supabase.rpc('apply_address_change', {
    p_delivery_id: input.deliveryId,
    p_new_address: input.newAddress,
    p_new_area: input.newArea ?? null,
    p_new_postal: input.newPostal ?? null,
    p_new_lat: input.newLat,
    p_new_lng: input.newLng,
    p_new_zone_id: zoneId,
    p_geocode_confidence: input.geocodeConfidence,
    p_source: input.source,
    p_evidence_photo_url: input.evidencePhotoUrl ?? null,
    p_changed_by: input.changedBy ?? null,
    p_actor_type: input.actorType ?? 'driver',
  })
  if (error) {
    console.log('[v0] applyAddressChange failed:', error.message)
    throw error
  }
  return data as string
}

/** Full address-change history for a delivery, newest first. */
export async function getAddressHistory(
  deliveryId: string,
): Promise<AddressHistoryEntry[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('address_history')
    .select(
      'id, delivery_id, old_address, new_address, old_area, new_area, old_zone_id, new_zone_id, distance_delta_m, source, geocode_confidence, evidence_photo_url, actor_type, created_at',
    )
    .eq('delivery_id', deliveryId)
    .order('created_at', { ascending: false })
  if (error) {
    console.log('[v0] getAddressHistory failed:', error.message)
    return []
  }
  return (data ?? []).map(mapHistoryRow)
}

function mapHistoryRow(row: Record<string, unknown>): AddressHistoryEntry {
  return {
    id: row.id as string,
    deliveryId: row.delivery_id as string,
    oldAddress: (row.old_address as string) ?? null,
    newAddress: (row.new_address as string) ?? null,
    oldArea: (row.old_area as string) ?? null,
    newArea: (row.new_area as string) ?? null,
    oldZoneId: (row.old_zone_id as string) ?? null,
    newZoneId: (row.new_zone_id as string) ?? null,
    distanceDeltaM:
      typeof row.distance_delta_m === 'number' ? (row.distance_delta_m as number) : null,
    source: (row.source as string) ?? null,
    geocodeConfidence: (row.geocode_confidence as string) ?? null,
    evidencePhotoUrl: (row.evidence_photo_url as string) ?? null,
    actorType: (row.actor_type as string) ?? 'driver',
    createdAt: row.created_at as string,
  }
}

/** Pretty label + tailwind classes for a geocode confidence level. */
export function confidenceMeta(level: string | null | undefined): {
  label: string
  className: string
} {
  switch (level) {
    case 'complete':
      return { label: 'Verified', className: 'bg-emerald-100 text-emerald-800 border-emerald-200' }
    case 'inferred':
      return { label: 'Inferred', className: 'bg-amber-100 text-amber-800 border-amber-200' }
    case 'unconfirmed':
      return { label: 'Unconfirmed', className: 'bg-red-100 text-red-800 border-red-200' }
    case 'manual':
      return { label: 'Manual pin', className: 'bg-blue-100 text-blue-800 border-blue-200' }
    default:
      return { label: 'Not validated', className: 'bg-muted text-muted-foreground border-border' }
  }
}
