'use client'

import { useCallback, useEffect, useState } from 'react'
import { flushScanQueue, getQueuedScanCount } from '@/lib/scanning'

// ============================================================================
// Keeps the offline scan queue draining: flushes on mount, on reconnect, and
// on an interval, and surfaces the pending count + online state for the UI
// ("N scans pending sync").
// ============================================================================

export function useScanSync(): {
  pending: number
  online: boolean
  flushNow: () => Promise<void>
} {
  const [pending, setPending] = useState(0)
  const [online, setOnline] = useState(true)

  const refresh = useCallback(() => setPending(getQueuedScanCount()), [])

  const flushNow = useCallback(async () => {
    await flushScanQueue()
    refresh()
  }, [refresh])

  useEffect(() => {
    setOnline(typeof navigator === 'undefined' ? true : navigator.onLine)
    refresh()

    const onQueue = (e: Event) => {
      const n = (e as CustomEvent<number>).detail
      setPending(typeof n === 'number' ? n : getQueuedScanCount())
    }
    const onOnline = () => {
      setOnline(true)
      void flushNow()
    }
    const onOffline = () => setOnline(false)

    window.addEventListener('doms:scanqueue', onQueue as EventListener)
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)

    // Initial drain + periodic retry.
    void flushNow()
    const id = setInterval(() => {
      if (getQueuedScanCount() > 0) void flushNow()
    }, 20_000)

    return () => {
      window.removeEventListener('doms:scanqueue', onQueue as EventListener)
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
      clearInterval(id)
    }
  }, [flushNow, refresh])

  return { pending, online, flushNow }
}
