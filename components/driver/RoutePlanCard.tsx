'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Route, Navigation, Sparkles, ChevronDown, ChevronUp, MapPin, Warehouse, Package, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getCurrentPosition } from '@/lib/native/geolocation'
import type { Delivery } from '@/lib/types'
import type { Hub } from '@/lib/hubs'
import {
  appleMapsLink,
  buildStopList,
  googleMapsRouteLinks,
  optimizeJobOrder,
  routeLengthKm,
  wazeLink,
  type LatLng,
} from '@/lib/route-planner'

type Props = {
  orderedDeliveries: Delivery[]
  hubFor: (d: Delivery) => Hub | null
  onApplyOrder: (ids: string[], message: string) => Promise<void>
}

async function tryGetPosition(): Promise<LatLng | null> {
  try {
    const pos = await getCurrentPosition()
    return { lat: pos.lat, lng: pos.lng }
  } catch {
    return null
  }
}

function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
}

const STOP_ICON = { pickup: Package, dropoff: MapPin, hub: Warehouse } as const

export function RoutePlanCard({ orderedDeliveries, hubFor, onApplyOrder }: Props) {
  const [origin, setOrigin] = useState<LatLng | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [showStops, setShowStops] = useState(false)

  const stops = useMemo(() => buildStopList(orderedDeliveries, hubFor), [orderedDeliveries, hubFor])
  const distanceKm = useMemo(() => routeLengthKm(stops, origin), [stops, origin])
  const unmappedCount = stops.filter((s) => !s.point).length
  const nextStop = stops[0]

  const handleOptimize = async () => {
    setOptimizing(true)
    try {
      const here = (await tryGetPosition()) ?? origin
      if (here) setOrigin(here)
      const currentIds = orderedDeliveries.map((d) => d.id)
      const bestIds = optimizeJobOrder(orderedDeliveries, hubFor, here)
      if (bestIds.join() === currentIds.join()) {
        toast.success('Your order is already the shortest route')
        return
      }
      const byId = new Map(orderedDeliveries.map((d) => [d.id, d]))
      const before = routeLengthKm(stops, here)
      const after = routeLengthKm(
        buildStopList(bestIds.map((id) => byId.get(id)!), hubFor),
        here,
      )
      const saved = Math.max(0, before - after)
      await onApplyOrder(
        bestIds,
        saved >= 0.5 ? `Route optimized, about ${saved.toFixed(1)} km shorter` : 'Route optimized',
      )
    } finally {
      setOptimizing(false)
    }
  }

  const handleOpenGoogle = async () => {
    const here = origin ?? (await tryGetPosition())
    if (here) setOrigin(here)
    const links = googleMapsRouteLinks(stops, here)
    if (links.length === 0) return
    openExternal(links[0])
    if (links.length > 1) {
      toast.info(`Route split into ${links.length} parts`, {
        description: 'Google Maps allows 10 stops per route. Open part 2 from here when you finish part 1.',
      })
    }
  }

  if (stops.length === 0) return null

  const googleLinks = googleMapsRouteLinks(stops, origin)

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardContent className="p-4 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-blue)]/15 text-[var(--accent-blue)] flex items-center justify-center shrink-0">
              <Route className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm text-foreground">Route plan</p>
              <p className="text-xs text-muted-foreground">
                {stops.length} {stops.length === 1 ? 'stop' : 'stops'}
                {distanceKm > 0 && ` · about ${distanceKm.toFixed(1)} km${origin ? ' from you' : ''}`}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleOptimize}
            disabled={optimizing || orderedDeliveries.length < 2}
            className="h-9 rounded-lg border-[var(--border-color)] text-xs shrink-0"
          >
            {optimizing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
            Optimize
          </Button>
        </div>

        <Button
          onClick={handleOpenGoogle}
          className="w-full h-11 rounded-xl bg-[var(--accent-blue)] hover:bg-[var(--accent-blue)]/90 text-white font-medium"
        >
          <Navigation className="w-4 h-4 mr-2" />
          Open full route in Google Maps
        </Button>

        {googleLinks.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {googleLinks.map((url, i) => (
              <Button
                key={url}
                size="sm"
                variant="outline"
                onClick={() => openExternal(url)}
                className="h-8 rounded-lg border-[var(--border-color)] text-xs"
              >
                Part {i + 1}
              </Button>
            ))}
          </div>
        )}

        {nextStop && (
          <div className="flex items-center justify-between gap-2 rounded-lg bg-[var(--bg-card-2)] p-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Next stop</p>
              <p className="text-sm text-foreground truncate">{nextStop.address}</p>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExternal(wazeLink(nextStop))}
                className="h-8 rounded-lg border-[var(--border-color)] text-xs"
              >
                Waze
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => openExternal(appleMapsLink(nextStop))}
                className="h-8 rounded-lg border-[var(--border-color)] text-xs"
              >
                Apple
              </Button>
            </div>
          </div>
        )}

        <button
          onClick={() => setShowStops((v) => !v)}
          className="flex items-center justify-center gap-1 text-xs text-[var(--accent-blue)]"
          aria-expanded={showStops}
        >
          {showStops ? 'Hide stops' : 'Show all stops'}
          {showStops ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
        </button>

        {showStops && (
          <ol className="flex flex-col gap-2">
            {stops.map((stop, i) => {
              const Icon = STOP_ICON[stop.kind]
              return (
                <li key={`${stop.deliveryId}-${stop.kind}`} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-[var(--bg-card-2)] text-xs font-medium text-foreground flex items-center justify-center shrink-0">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon className="w-3 h-3" />
                      {stop.label}
                    </p>
                    <p className="text-sm text-foreground leading-relaxed">{stop.address}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}

        {unmappedCount > 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {unmappedCount} {unmappedCount === 1 ? 'stop has' : 'stops have'} no map location yet, so{' '}
            {unmappedCount === 1 ? 'it stays' : 'they stay'} at the end when optimizing.
          </p>
        )}
      </CardContent>
    </Card>
  )
}
