'use client'

import { useEffect, useState } from 'react'
import { getFeatureSettings, type FeatureSettings } from '@/lib/feature-settings'

// ============================================================================
// Lightweight client hook to read a single feature flag. Fetches the settings
// bag once (cached in module state) and returns the requested key. Defaults to
// `false` for boolean flags until loaded so gated UI fails safe.
// ============================================================================

let cached: FeatureSettings | null = null
let inflight: Promise<FeatureSettings> | null = null

function load(): Promise<FeatureSettings> {
  if (cached) return Promise.resolve(cached)
  if (!inflight) {
    inflight = getFeatureSettings()
      .then((s) => {
        cached = s
        return s
      })
      .finally(() => {
        inflight = null
      })
  }
  return inflight
}

export function useFeatureFlag<K extends keyof FeatureSettings>(
  key: K,
): FeatureSettings[K] | false {
  const [value, setValue] = useState<FeatureSettings[K] | false>(
    cached ? cached[key] : false,
  )
  useEffect(() => {
    let active = true
    load()
      .then((s) => {
        if (active) setValue(s[key])
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [key])
  return value
}

export function useFeatureSettings(): FeatureSettings | null {
  const [settings, setSettings] = useState<FeatureSettings | null>(cached)
  useEffect(() => {
    let active = true
    load()
      .then((s) => {
        if (active) setSettings(s)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])
  return settings
}
