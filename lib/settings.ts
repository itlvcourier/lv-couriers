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

export const defaultSettings: SystemSettings = {
  id: 'main',
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
    .eq('id', 'main')
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
      id: 'main',
      ...settings,
      updated_at: new Date().toISOString(),
      updated_by: userData?.user?.id || null,
    })
  
  if (error) {
    return { success: false, error: error.message }
  }
  
  return { success: true }
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
