'use client'

import { createClient } from '@/lib/supabase/client'

// ============================================================================
// Feature flags (cross-dock operating model)
// Backed by the live `org_settings` table: a single-row jsonb bag keyed by a
// fixed single-tenant sentinel org_id. See v0_plans/sharp-map.md (Phase 0).
// ============================================================================

export const ORG_ID = '00000000-0000-0000-0000-000000000001'

export type AddressValidationLevel = 'off' | 'soft' | 'hard'
export type DriverPayModel = 'per_order' | 'per_leg'

export interface FeatureSettings {
  // Routing / zones
  zones_enabled: boolean
  auto_assign_driver: boolean
  consolidation_enabled: boolean
  route_optimization_enabled: boolean
  // Intake / cutoff
  cutoff_enabled: boolean
  late_requests_enabled: boolean
  // Transfers
  driver_transfers_enabled: boolean
  transfer_requires_admin: boolean
  // Address intelligence
  address_validation_level: AddressValidationLevel
  driver_address_change_requires_approval: boolean
  inbound_sms_address_capture: boolean
  // Tracking / proof
  auto_geofence_events: boolean
  barcode_scanning_required: boolean
  proof_of_delivery_required: boolean
  recipient_live_tracking_enabled: boolean
  // Money
  driver_pay_model: DriverPayModel
}

export const defaultFeatureSettings: FeatureSettings = {
  zones_enabled: true,
  auto_assign_driver: true,
  consolidation_enabled: true,
  route_optimization_enabled: true,
  cutoff_enabled: true,
  late_requests_enabled: true,
  driver_transfers_enabled: true,
  transfer_requires_admin: false,
  address_validation_level: 'soft',
  driver_address_change_requires_approval: true,
  inbound_sms_address_capture: false,
  auto_geofence_events: true,
  barcode_scanning_required: false,
  proof_of_delivery_required: true,
  recipient_live_tracking_enabled: true,
  driver_pay_model: 'per_leg',
}

/** Merge a partial/unknown jsonb blob onto the typed defaults (default-safe). */
function normalize(raw: unknown): FeatureSettings {
  if (!raw || typeof raw !== 'object') return { ...defaultFeatureSettings }
  return { ...defaultFeatureSettings, ...(raw as Partial<FeatureSettings>) }
}

export async function getFeatureSettings(): Promise<FeatureSettings> {
  const supabase = createClient()
  if (!supabase) return { ...defaultFeatureSettings }

  const { data, error } = await supabase
    .from('org_settings')
    .select('settings')
    .eq('org_id', ORG_ID)
    .maybeSingle()

  if (error || !data) return { ...defaultFeatureSettings }
  return normalize((data as { settings: unknown }).settings)
}

export async function updateFeatureSettings(
  patch: Partial<FeatureSettings>,
): Promise<{ success: boolean; error?: string; settings?: FeatureSettings }> {
  const supabase = createClient()
  if (!supabase) return { success: false, error: 'Supabase client unavailable' }

  // Read-modify-write so we never clobber keys we don't know about.
  const current = await getFeatureSettings()
  const next = { ...current, ...patch }

  const { data: userData } = await supabase.auth.getUser()

  const { error } = await supabase.from('org_settings').upsert(
    {
      org_id: ORG_ID,
      settings: next,
      updated_at: new Date().toISOString(),
      updated_by: userData?.user?.id ?? null,
    },
    { onConflict: 'org_id' },
  )

  if (error) return { success: false, error: error.message }
  return { success: true, settings: next }
}

// ============================================================================
// Mode presets (spec §0): one-click bundles that flip the routing model.
// "direct" = legacy point-to-point; "cross_dock" = hub consolidation model.
// Presets only touch routing/intake/transfer toggles, leaving operational
// preferences (proof, tracking, pay model) under independent control.
// ============================================================================

export type OperatingMode = 'direct' | 'cross_dock'

export const modePresets: Record<OperatingMode, Partial<FeatureSettings>> = {
  direct: {
    zones_enabled: false,
    auto_assign_driver: true,
    consolidation_enabled: false,
    route_optimization_enabled: false,
    cutoff_enabled: false,
    late_requests_enabled: true,
    driver_transfers_enabled: false,
  },
  cross_dock: {
    zones_enabled: true,
    auto_assign_driver: true,
    consolidation_enabled: true,
    route_optimization_enabled: true,
    cutoff_enabled: true,
    late_requests_enabled: true,
    driver_transfers_enabled: true,
  },
}

/** Best-effort detection of the current mode from the live settings. */
export function detectOperatingMode(s: FeatureSettings): OperatingMode | null {
  const matches = (preset: Partial<FeatureSettings>) =>
    (Object.keys(preset) as (keyof FeatureSettings)[]).every(
      (k) => s[k] === preset[k],
    )
  if (matches(modePresets.cross_dock)) return 'cross_dock'
  if (matches(modePresets.direct)) return 'direct'
  return null
}
