'use client'

// ============================================================================
// Shared Google Maps JS API loader.
//
// Components used to each inject their own <script> tag (some with only the
// `places` library), which meant the Drawing library wasn't guaranteed to be
// available and multiple mismatched scripts collided. This centralizes loading
// into a single <script> tag that requests EVERY library we use, and resolves
// one shared promise.
//
// We deliberately use the classic loader (libraries in the URL, no
// `loading=async`). At `onload` the classic loader populates the entire
// namespace synchronously — `google.maps.places.AutocompleteSuggestion`,
// `google.maps.drawing.DrawingManager`, etc. — without needing `importLibrary`,
// which is only reliably available under the async bootstrap pattern.
// ============================================================================

const LIBRARIES = ['places', 'drawing', 'geometry', 'marker'] as const

let loadPromise: Promise<typeof google> | null = null

// Resolves once the CORE libraries the maps depend on are present: the base
// Map class plus the drawing + geometry libraries (used by the zone editor).
//
// We intentionally do NOT gate on `places.AutocompleteSuggestion` here. That
// class only exists when the "Places API (New)" is enabled on the Google Cloud
// project; gating on it meant that for projects without Places-New enabled the
// loader would time out and the ENTIRE map (including drawing) failed to load.
// Address autocomplete checks for `AutocompleteSuggestion` itself and degrades
// gracefully, so it must not block map/drawing readiness.
function whenReady(resolve: (g: typeof google) => void, reject: (e: Error) => void) {
  const started = Date.now()
  const check = () => {
    const m = window.google?.maps
    if (m?.Map && m?.drawing?.DrawingManager && m?.geometry) {
      resolve(window.google)
      return
    }
    if (Date.now() - started > 10000) {
      reject(new Error('Google Maps libraries did not initialize in time'))
      return
    }
    setTimeout(check, 50)
  }
  check()
}

export function loadGoogleMaps(): Promise<typeof google> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Maps can only load in the browser'))
  }
  if (loadPromise) return loadPromise

  loadPromise = new Promise<typeof google>((resolve, reject) => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
    if (!apiKey) {
      reject(new Error('NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not configured'))
      return
    }

    // Already available (or a script is in flight from a prior call/component)?
    // Either way, just wait for the namespace to be ready.
    if (window.google?.maps || document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')) {
      whenReady(resolve, reject)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${LIBRARIES.join(',')}&v=weekly`
    script.async = true
    script.defer = true
    script.onload = () => whenReady(resolve, reject)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}
