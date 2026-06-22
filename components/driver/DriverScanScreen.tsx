'use client'

import { useEffect, useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { Scanner } from './Scanner'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import type { ScanContext } from '@/lib/scanning'
import { recordHubCheckin } from '@/lib/consolidation'
import { getDefaultHub } from '@/lib/hubs'
import { getCurrentPosition } from '@/lib/native/geolocation'

// ============================================================================
// Driver "Scan" screen. The driver picks what they're doing (pickup run,
// hub sort/accept, or delivery); the Scanner then records the right custody
// event for each scanned label. Manual fallback is allowed unless
// barcode_scanning_required is on.
// ============================================================================

const TABS: { id: ScanContext; label: string; hint: string }[] = [
  { id: 'pickup', label: 'Pickup', hint: 'Scan parcels as you collect them from the business.' },
  { id: 'hub_sort', label: 'Sort', hint: 'Scan to route each parcel to the right bin at the hub.' },
  { id: 'hub_accept', label: 'Accept', hint: 'Scan parcels you are taking from the hub for delivery.' },
  { id: 'delivery', label: 'Deliver', hint: 'Scan at the drop to record delivery.' },
]

export function DriverScanScreen() {
  const { currentUser, deliveries } = useApp()
  const scanningRequired = useFeatureFlag('barcode_scanning_required')
  const driverId = currentUser?.driverId || ''
  const [context, setContext] = useState<ScanContext>('pickup')

  // §6 oversight: while a driver is working at the hub (sorting or accepting),
  // record/refresh their hub check-in so the admin board shows who is present.
  useEffect(() => {
    if (!driverId) return
    if (context !== 'hub_sort' && context !== 'hub_accept') return
    let cancelled = false
    const checkIn = async () => {
      let lat: number | null = null
      let lng: number | null = null
      try {
        const pos = await getCurrentPosition()
        lat = pos.lat
        lng = pos.lng
      } catch {
        /* location optional */
      }
      if (cancelled) return
      // Stamp which hub the driver is checking in at (the org default) so the
      // admin sort board shows a real location instead of a blank.
      const hubName = await getDefaultHub()
        .then((h) => h?.name ?? null)
        .catch(() => null)
      if (cancelled) return
      try {
        await recordHubCheckin({ driverId, hubName, lat, lng })
      } catch {
        /* best effort */
      }
    }
    void checkIn()
    // Refresh presence every 2 min while on a hub tab.
    const id = setInterval(() => { void checkIn() }, 120_000)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [context, driverId])

  // Candidate parcels for the manual fallback, scoped by context.
  const candidates = useMemo(() => {
    switch (context) {
      case 'pickup':
        return deliveries.filter(
          (d) => d.driverId === driverId && (d.legStatus ?? 'created') === 'created',
        )
      case 'hub_sort':
        return deliveries.filter((d) => (d.legStatus ?? 'created') === 'picked_up')
      case 'hub_accept':
        return deliveries.filter((d) => (d.legStatus ?? 'created') === 'at_hub')
      case 'delivery':
        return deliveries.filter(
          (d) =>
            d.driverId === driverId &&
            ['out_for_delivery', 'at_hub', 'picked_up'].includes(d.legStatus ?? 'created'),
        )
      default:
        return []
    }
  }, [context, deliveries, driverId])

  const toHolder =
    context === 'hub_sort'
      ? 'hub'
      : context === 'delivery'
        ? 'recipient'
        : driverId
          ? `driver:${driverId}`
          : null

  const activeTab = TABS.find((t) => t.id === context)!

  return (
    <div className="flex flex-col gap-4">
      {/* Context selector */}
      <div className="grid grid-cols-4 gap-1 rounded-lg bg-[var(--bg-card)] border border-[var(--border-color)] p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setContext(t.id)}
            className={`h-10 rounded-md text-sm font-medium transition-colors ${
              context === t.id
                ? 'bg-[var(--accent-orange)] text-white'
                : 'text-muted-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground -mt-1">{activeTab.hint}</p>

      <Scanner
        key={context}
        context={context}
        candidates={candidates}
        toHolder={toHolder}
        allowManual={!scanningRequired}
      />
    </div>
  )
}
