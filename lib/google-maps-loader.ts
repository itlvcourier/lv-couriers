'use client'

// ============================================================================
// Shared Google Maps JS API loader.
//
// Components used to each inject their own <script> tag (some with only the
// `places` library), which meant the Drawing library wasn't guaranteed to be
// available. This centralizes loading: it injects the script once with all the
// libraries we use, and resolves a single shared promise. When the script is
// already present (loaded by another component) it falls back to
// `importLibrary` so the requested library is pulled in regardless.
// ============================================================================

const LIBRARIES = ['places', 'drawing', 'geometry', 'marker'] as const

let loadPromise: Promise<typeof google> | null = null

/**
 * Ensure every library we depend on is actually present on `google.maps`.
 *
 * Other components (AddressAutocomplete, GoogleTrackingMap) inject their own
 * Maps script with only `libraries=places`. If one of those loads first,
 * `window.google.maps` exists but WITHOUT `drawing`/`geometry`/`marker`, which
 * previously crashed the zone manager on `google.maps.drawing.DrawingManager`.
 * `importLibrary` is available on any loaded Maps JS API and idempotently pulls
 * in a missing library, so we await it for each one we need.
 */
async function ensureLibraries(): Promise<typeof google> {
  const g = window.google
  if (g?.maps?.importLibrary) {
    await Promise.all(LIBRARIES.map((lib) => g.maps.importLibrary(lib)))
  }
  return window.google
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

    const finish = () => ensureLibraries().then(resolve, reject)

    // Already available? Still make sure our libraries are loaded.
    if (window.google?.maps) {
      void finish()
      return
    }

    // A script may already be loading (injected by another component).
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src*="maps.googleapis.com/maps/api/js"]',
    )
    if (existing) {
      const poll = setInterval(() => {
        if (window.google?.maps) {
          clearInterval(poll)
          void finish()
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${LIBRARIES.join(',')}&loading=async`
    script.async = true
    script.defer = true
    script.onload = () => void finish()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}
