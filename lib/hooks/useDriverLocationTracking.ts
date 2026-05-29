'use client'

import { useEffect, useRef } from 'react'
import { watchPosition, type SimplePosition } from '@/lib/native/geolocation'
import { updateDriverLocation } from '@/lib/db'

/**
 * Pushes the driver's live GPS position to `driver_locations` while they have an
 * active in-transit delivery. The recipient's public tracking page reads from
 * the same table, so this is what makes the "live location" dot move.
 *
 * - Only runs when `enabled` is true (i.e. there's an active delivery) and a
 *   `driverId` exists.
 * - Throttles writes to at most once every `minIntervalMs` to avoid hammering
 *   the DB while still feeling live.
 * - Works on web (navigator.geolocation) and native (Capacitor) via the bridge.
 */
export function useDriverLocationTracking(params: {
  driverId: string | undefined
  deliveryId: string | undefined
  enabled: boolean
  minIntervalMs?: number
}) {
  const { driverId, deliveryId, enabled, minIntervalMs = 10_000 } = params

  // Keep the latest deliveryId in a ref so the watcher always tags the newest
  // active delivery without needing to tear down and re-create the watch.
  const deliveryIdRef = useRef<string | undefined>(deliveryId)
  deliveryIdRef.current = deliveryId

  const lastWriteRef = useRef<number>(0)

  useEffect(() => {
    if (!enabled || !driverId) return

    let cancelled = false
    let unsubscribe: (() => void) | null = null

    const onUpdate = (pos: SimplePosition) => {
      const now = Date.now()
      if (now - lastWriteRef.current < minIntervalMs) return
      lastWriteRef.current = now
      void updateDriverLocation(
        driverId,
        pos.lat,
        pos.lng,
        deliveryIdRef.current,
        pos.heading ?? undefined,
        pos.speed ?? undefined,
        pos.accuracy ?? undefined,
      ).catch((err) => {
        console.error('[v0] live location write failed', err)
      })
    }

    watchPosition(onUpdate, (err) => {
      console.error('[v0] live location watch error', err.code, err.message)
    }).then((unsub) => {
      if (cancelled) {
        unsub()
      } else {
        unsubscribe = unsub
      }
    })

    return () => {
      cancelled = true
      if (unsubscribe) unsubscribe()
    }
  }, [enabled, driverId, minIntervalMs])
}
