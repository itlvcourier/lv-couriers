'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { subscribeToDriverLocation, getLatestDriverLocation } from '@/lib/live-tracking'
import type { DriverLocation } from '@/lib/types'

const DeliveryMap = dynamic(() => import('./DeliveryMap'), { ssr: false })

interface LiveTrackingProps {
  driverId: string
  driverName: string
  pickupLat?: number
  pickupLng?: number
  dropoffLat?: number
  dropoffLng?: number
}

export function LiveTracking({
  driverId,
  driverName,
  pickupLat,
  pickupLng,
  dropoffLat,
  dropoffLng,
}: LiveTrackingProps) {
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let subscription: any = null
    let mounted = true

    const initTracking = async () => {
      try {
        // Get initial location
        const initial = await getLatestDriverLocation(driverId)
        if (mounted) {
          setDriverLocation(initial)
        }

        // Subscribe to updates
        subscription = await subscribeToDriverLocation(driverId, (location) => {
          if (mounted) {
            setDriverLocation(location)
          }
        })

        if (mounted) {
          setLoading(false)
        }
      } catch (error) {
        console.error('[v0] Error initializing tracking:', error)
        if (mounted) {
          setLoading(false)
        }
      }
    }

    initTracking()

    return () => {
      mounted = false
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [driverId])

  if (loading) {
    return (
      <div className="h-96 w-full bg-slate-900 rounded-lg flex items-center justify-center">
        <p className="text-foreground/60">Loading live location...</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-2">
        <h3 className="font-semibold text-foreground">Live Tracking</h3>
        {driverLocation && (
          <span className="text-xs text-foreground/60">
            Last update: {new Date(driverLocation.updated_at).toLocaleTimeString()}
          </span>
        )}
      </div>

      <DeliveryMap
        driverLocation={driverLocation}
        pickupLat={pickupLat}
        pickupLng={pickupLng}
        dropoffLat={dropoffLat}
        dropoffLng={dropoffLng}
        driverName={driverName}
      />
    </div>
  )
}
