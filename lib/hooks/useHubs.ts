'use client'

import { useEffect, useState } from 'react'
import { getHubs, type Hub } from '@/lib/hubs'

// ============================================================================
// Reactive client store for hubs (cross-dock meet/sort points).
//
// Mirrors the feature-flag store: one shared cache, a background poll so an
// admin editing a hub in one tab propagates to driver tabs, and an explicit
// `invalidateHubs()` for an immediate re-read after a write. Driver cards read
// hub name/address/meet-time from here without a per-card fetch.
// ============================================================================

let cached: Hub[] | null = null
let inflight: Promise<Hub[]> | null = null
const listeners = new Set<() => void>()
let pollTimer: ReturnType<typeof setInterval> | null = null
const POLL_MS = 30000

function emit() {
  listeners.forEach((l) => l())
}

function fetchHubs(): Promise<Hub[]> {
  if (!inflight) {
    // Include inactive hubs so admin management sees everything; consumers that
    // only want routable hubs filter on isActive.
    inflight = getHubs(true)
      .then((h) => {
        const changed = !cached || JSON.stringify(h) !== JSON.stringify(cached)
        cached = h
        if (changed) emit()
        return h
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
    fetchHubs().catch(() => {})
  }, POLL_MS)
}

function maybeStopPolling() {
  if (listeners.size === 0 && pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

/** Force an immediate re-read of hubs and notify all consumers. */
export function invalidateHubs(): void {
  cached = null
  fetchHubs().catch(() => {})
}

function useHubsStore(): Hub[] | null {
  const [, force] = useState(0)
  useEffect(() => {
    const listener = () => force((n) => n + 1)
    listeners.add(listener)
    ensurePolling()
    fetchHubs().catch(() => {})
    return () => {
      listeners.delete(listener)
      maybeStopPolling()
    }
  }, [])
  return cached
}

/** All hubs (active + inactive), default first. Null until first load. */
export function useHubs(): Hub[] | null {
  return useHubsStore()
}

/** Active hubs only — the ones drivers can be routed to. */
export function useActiveHubs(): Hub[] {
  const hubs = useHubsStore()
  return (hubs ?? []).filter((h) => h.isActive)
}

/** Look up a single hub by id from the shared cache. */
export function useHubById(hubId: string | null | undefined): Hub | null {
  const hubs = useHubsStore()
  if (!hubId || !hubs) return null
  return hubs.find((h) => h.id === hubId) ?? null
}
