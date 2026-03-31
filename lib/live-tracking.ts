'use client'

import { createClient } from '@/lib/supabase/client'
import type { DriverLocation } from '@/lib/types'

export async function startLocationTracking(
  driverId: string,
  deliveryId: string | null,
  onLocationUpdate?: (location: DriverLocation) => void
): Promise<() => void> {
  const supabase = createClient()

  if (!navigator.geolocation) {
    throw new Error('Geolocation not supported')
  }

  let watchId: number | null = null

  const updateLocation = async (latitude: number, longitude: number, heading?: number, speed?: number) => {
    try {
      const { data, error } = await supabase
        .from('driver_locations')
        .upsert(
          {
            driver_id: driverId,
            delivery_id: deliveryId,
            latitude,
            longitude,
            heading,
            speed,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: 'driver_id',
          }
        )
        .select()
        .single()

      if (error) {
        console.error('[v0] Error updating location:', error)
        return
      }

      if (data && onLocationUpdate) {
        onLocationUpdate(data)
      }
    } catch (err) {
      console.error('[v0] Failed to update location:', err)
    }
  }

  watchId = navigator.geolocation.watchPosition(
    (position) => {
      const { latitude, longitude, heading, speed } = position.coords
      updateLocation(latitude, longitude, heading ?? undefined, speed ?? undefined)
    },
    (error) => {
      console.error('[v0] Geolocation error:', error)
    },
    {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 10000,
    }
  )

  return () => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      watchId = null
    }
  }
}

export async function subscribeToDriverLocation(
  driverId: string,
  onUpdate: (location: DriverLocation) => void,
  onError?: (error: Error) => void
) {
  const supabase = createClient()

  const subscription = supabase
    .channel(`driver_location_${driverId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'driver_locations',
        filter: `driver_id=eq.${driverId}`,
      },
      (payload) => {
        onUpdate(payload.new as DriverLocation)
      }
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[v0] Subscribed to driver location')
      } else if (status === 'CLOSED') {
        console.log('[v0] Unsubscribed from driver location')
      }
    })

  return subscription
}

export async function getLatestDriverLocation(driverId: string): Promise<DriverLocation | null> {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('driver_locations')
    .select('*')
    .eq('driver_id', driverId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') {
    console.error('[v0] Error fetching driver location:', error)
    return null
  }

  return data || null
}
