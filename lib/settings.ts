'use client'

import { createClient } from '@/lib/supabase/client'

export interface SystemSettings {
  id: string
  driver_pay_enabled: boolean
  driver_base_rate: number
  driver_rush_bonus: number
  driver_urgent_bonus: number
  driver_distance_rate: number
  updated_at: string
  updated_by: string | null
}

// Fixed UUID for main settings row
const SETTINGS_ID = '00000000-0000-0000-0000-000000000001'

export const defaultSettings: SystemSettings = {
  id: SETTINGS_ID,
  driver_pay_enabled: false,
  driver_base_rate: 5.00,
  driver_rush_bonus: 2.00,
  driver_urgent_bonus: 5.00,
  driver_distance_rate: 0.50,
  updated_at: new Date().toISOString(),
  updated_by: null,
}

export async function getSystemSettings(): Promise<SystemSettings> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single()
  
  if (error || !data) {
    // Return defaults if table doesn't exist or no data
    return defaultSettings
  }
  
  return data as SystemSettings
}

export async function updateSystemSettings(
  settings: Partial<Omit<SystemSettings, 'id' | 'updated_at'>>
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient()
  
  const { data: userData } = await supabase.auth.getUser()
  
  const { error } = await supabase
    .from('system_settings')
    .upsert({
      id: SETTINGS_ID,
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: userData?.user?.id || null,
    })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
}

export interface LegEarnings {
  pickup: { jobs: number; total: number }
  delivery: { jobs: number; total: number }
  full: { jobs: number; total: number }
  total: number
}

/**
 * Authoritative per-leg earnings for a driver over a date range, read from the
 * driver_leg_earnings ledger (§4). Unlike the delivery-derived estimate this
 * includes pickup-only legs the driver no longer holds after a hub handoff.
 */
export async function getDriverLegEarnings(
  driverId: string,
  from: Date,
  to: Date,
): Promise<LegEarnings> {
  const empty: LegEarnings = {
    pickup: { jobs: 0, total: 0 },
    delivery: { jobs: 0, total: 0 },
    full: { jobs: 0, total: 0 },
    total: 0,
  }
  const supabase = createClient()
  if (!supabase || !driverId) return empty

  const { data, error } = await supabase.rpc('driver_earnings_summary', {
    p_driver_id: driverId,
    p_from: from.toISOString(),
    p_to: to.toISOString(),
  })
  if (error || !data) return empty

  const result = { ...empty }
  for (const row of data as Array<{ leg: 'pickup' | 'delivery' | 'full'; jobs: number; total: number }>) {
    const amt = Number(row.total) || 0
    if (row.leg in result) {
      result[row.leg] = { jobs: Number(row.jobs) || 0, total: amt }
    }
    result.total += amt
  }
  return result
}

// Calculate driver earnings for a delivery
export function calculateDriverPay(
  settings: SystemSettings,
  delivery: {
    is_rush?: boolean
    is_urgent?: boolean
    distance_km?: number
  }
): number {
  if (!settings.driver_pay_enabled) {
    return 0
  }
  
  let total = settings.driver_base_rate
  
  if (delivery.is_rush) {
    total += settings.driver_rush_bonus
  }
  
  if (delivery.is_urgent) {
    total += settings.driver_urgent_bonus
  }
  
  if (delivery.distance_km && settings.driver_distance_rate > 0) {
    total += delivery.distance_km * settings.driver_distance_rate
  }
  
  return Math.round(total * 100) / 100
}
