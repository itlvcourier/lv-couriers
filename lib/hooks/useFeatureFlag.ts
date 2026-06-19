'use client'

import { useEffect, useState } from 'react'
import { getFeatureSettings, type FeatureSettings } from '@/lib/feature-settings'

// ============================================================================
// Reactive client store for feature flags.
//
// Previously this cached the settings bag in a module variable that was never
// invalidated, so flag changes (e.g. switching Operating Mode to Direct) never
// reached already-open sessions — the cross-dock UI stayed visible until a hard
// reload. This store fixes that by:
//   - notifying every consumer when the settings change,
//   - polling in the background so changes made in *another* session (admin tab
//     vs. driver tab / device) propagate automatically, and
//   - exposing `invalidateFeatureSettings()` for an immediate re-read right
//     after a write.
// Flags still default to `false` until the first load so gated UI fails safe.
// ============================================================================

let cached: FeatureSettings | null = null
let inflight: Promise<FeatureSettings> | null = null
const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_MS = 10000

function emit() {
  listeners.forEach((l) => l())
}

function fetchSettings(): Promise<FeatureSettings> {
  if (!inflight) {
    inflight = getFeatureSettings()
      .then((s) => {
        const changed = !cached || JSON.stringify(s) !== JSON.stringify(cached)
        cached = s
        if (changed) emit()
        return s
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

function ensurePolling() {
  if (pollTimer || typeof window === 'undefined') return
  pollTimer = setInterval(() => {
    fetchSettings().catch(() => {})
  }, POLL_MS)
}

function maybeStopPolling() {
  if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/**
 * Force an immediate re-read of the settings bag and notify all consumers.
 * Call this right after persisting a settings change so the writer's own
 * session updates instantly instead of waiting for the next poll.
 */
export function invalidateFeatureSettings(): void {
  cached = null
  fetchSettings().catch(() => {})
}

function useSettingsStore(): FeatureSettings | null {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    ensurePolling()
    // Kick off an initial load (and a refresh on every mount so a freshly
    // opened screen always reflects the latest persisted settings).
    fetchSettings().catch(() => {})
    return () => {
      listeners.delete(listener)
      maybeStopPolling()
    }
  }, [])
  return cached
}

export function useFeatureFlag<K extends keyof FeatureSettings>(
  key: K,
): FeatureSettings[K] | false {
  const settings = useSettingsStore()
  return settings ? settings[key] : false
}

export function useFeatureSettings(): FeatureSettings | null {
  return useSettingsStore()
}
