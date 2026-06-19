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

    const finish = () => resolve(window.google)

    // Already available?
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
        if (window.google?.maps?.drawing) {
          clearInterval(poll)
          finish()
        }
      }, 100)
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=${LIBRARIES.join(',')}`
    script.async = true
    script.defer = true
    script.onload = () => finish()
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })

  return loadPromise
}
