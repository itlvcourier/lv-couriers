import { isNativeApp } from './index'

/**
 * Geolocation bridge.
 *
 * Provides one consistent shape ({ lat, lng, accuracy, timestamp }) whether the
 * position comes from the native GPS (@capacitor/geolocation) or the browser's
 * navigator.geolocation. Callers (e.g. driver live-location) don't need to know
 * which environment they're in.
 */

export interface SimplePosition {
  lat: number
  lng: number
  accuracy: number
  heading: number | null
  speed: number | null
  timestamp: number
}

export interface PositionError {
  code: 'permission_denied' | 'unavailable' | 'timeout' | 'unknown'
  message: string
}

const HIGH_ACCURACY_OPTS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 5000,
}

/** Get a single current position. Throws PositionError on failure. */
export async function getCurrentPosition(): Promise<SimplePosition> {
  if (isNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation')
    try {
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        await Geolocation.requestPermissions({ permissions: ['location'] })
      }
    } catch {
      // continue; getCurrentPosition will surface a real error if denied
    }
    try {
      const pos = await Geolocation.getCurrentPosition(HIGH_ACCURACY_OPTS)
      return mapCoords(pos.coords, pos.timestamp)
    } catch (e) {
      throw normalizeError(e)
    }
  }

  // Web fallback
  return await new Promise<SimplePosition>((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject({ code: 'unavailable', message: 'Geolocation not supported' } as PositionError)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(mapCoords(pos.coords, pos.timestamp)),
      (err) => reject(normalizeBrowserError(err)),
      HIGH_ACCURACY_OPTS,
    )
  })
}

/**
 * Continuously watch position. Returns an async unsubscribe function.
 * `onUpdate` is called on each new fix; `onError` on each failure.
 */
export async function watchPosition(
  onUpdate: (pos: SimplePosition) => void,
  onError?: (err: PositionError) => void,
): Promise<() => void> {
  if (isNativeApp()) {
    const { Geolocation } = await import('@capacitor/geolocation')
    try {
      const perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        await Geolocation.requestPermissions({ permissions: ['location'] })
      }
    } catch {
      // continue
    }
    const id = await Geolocation.watchPosition(HIGH_ACCURACY_OPTS, (pos, err) => {
      if (err) {
        onError?.(normalizeError(err))
        return
      }
      if (pos) onUpdate(mapCoords(pos.coords, pos.timestamp))
    })
    return () => {
      Geolocation.clearWatch({ id }).catch(() => {})
    }
  }

  // Web fallback
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    onError?.({ code: 'unavailable', message: 'Geolocation not supported' })
    return () => {}
  }
  const watchId = navigator.geolocation.watchPosition(
    (pos) => onUpdate(mapCoords(pos.coords, pos.timestamp)),
    (err) => onError?.(normalizeBrowserError(err)),
    HIGH_ACCURACY_OPTS,
  )
  return () => navigator.geolocation.clearWatch(watchId)
}

function mapCoords(
  coords: {
    latitude: number
    longitude: number
    accuracy: number
    heading?: number | null
    speed?: number | null
  },
  timestamp: number,
): SimplePosition {
  return {
    lat: coords.latitude,
    lng: coords.longitude,
    accuracy: coords.accuracy,
    heading: coords.heading ?? null,
    speed: coords.speed ?? null,
    timestamp,
  }
}

function normalizeError(e: unknown): PositionError {
  const message = e instanceof Error ? e.message : String(e)
  if (/denied|permission/i.test(message)) return { code: 'permission_denied', message }
  if (/timeout/i.test(message)) return { code: 'timeout', message }
  if (/unavailable|disabled|location services/i.test(message))
    return { code: 'unavailable', message }
  return { code: 'unknown', message }
}

function normalizeBrowserError(err: GeolocationPositionError): PositionError {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return { code: 'permission_denied', message: err.message }
    case err.POSITION_UNAVAILABLE:
      return { code: 'unavailable', message: err.message }
    case err.TIMEOUT:
      return { code: 'timeout', message: err.message }
    default:
      return { code: 'unknown', message: err.message }
  }
}
