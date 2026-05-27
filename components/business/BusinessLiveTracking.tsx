'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import {
  MapPin,
  Navigation,
  Phone,
  Clock,
  Battery,
  Package,
  Radio,
  UserRound,
} from 'lucide-react'
import { DeliveryMap, type MapLocation } from '@/components/maps/DeliveryMap'
import type { Delivery, DeliveryStatus } from '@/lib/types'

const IN_TRANSIT_STATUSES: DeliveryStatus[] = [
  'claimed',
  'en_route_pickup',
  'picked_up',
  'en_route_dropoff',
]

function statusLabel(status: DeliveryStatus): string {
  switch (status) {
    case 'claimed':
      return 'Driver assigned'
    case 'en_route_pickup':
      return 'Heading to pickup'
    case 'picked_up':
      return 'Picked up'
    case 'en_route_dropoff':
      return 'Out for delivery'
    default:
      return status
  }
}

function statusTone(status: DeliveryStatus): string {
  switch (status) {
    case 'en_route_pickup':
      return 'bg-blue-500/15 text-blue-500 border-blue-500/30'
    case 'picked_up':
    case 'en_route_dropoff':
      return 'bg-orange-500/15 text-orange-500 border-orange-500/30'
    default:
      return 'bg-muted text-muted-foreground border-border'
  }
}

function relativeTime(iso?: string | null): string {
  if (!iso) return ''
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs} hr ago`
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map(p => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function BusinessLiveTracking() {
  const { currentUser, deliveries, drivers, driverGPS, activeLocationId } = useApp()
  const [selectedDeliveryId, setSelectedDeliveryId] = useState<string | null>(null)

  const active = useMemo(() => {
    if (!currentUser?.businessId) return []
    return deliveries
      .filter(d => {
        if (d.businessId !== currentUser.businessId) return false
        if (!IN_TRANSIT_STATUSES.includes(d.status)) return false
        // Filter by location if specific location selected
        if (activeLocationId && activeLocationId !== 'all') {
          return d.locationId === activeLocationId
        }
        return true
      })
      .sort((a, b) => {
        // prioritize picked_up / en_route_dropoff, then by most recent update
        const rank = (s: DeliveryStatus) =>
          s === 'en_route_dropoff' ? 0 : s === 'picked_up' ? 1 : s === 'en_route_pickup' ? 2 : 3
        const diff = rank(a.status) - rank(b.status)
        if (diff !== 0) return diff
        return (b.postedAt ?? '').localeCompare(a.postedAt ?? '')
      })
  }, [currentUser?.businessId, deliveries, activeLocationId])

  const selectedDelivery = active.find(d => d.id === selectedDeliveryId) ?? null

  if (!currentUser?.businessId) {
    return null
  }

  if (active.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Live Tracking</h2>
            <p className="text-sm text-muted-foreground">
              Follow drivers as they move through your active deliveries.
            </p>
          </div>
        </div>
        <Card>
          <CardContent className="py-12">
            <Empty>
              <EmptyMedia>
                <Package className="w-10 h-10 text-muted-foreground" />
              </EmptyMedia>
              <EmptyTitle>No deliveries in transit</EmptyTitle>
              <EmptyDescription>
                Once a driver claims an order and starts moving, you&apos;ll see their live
                location here.
              </EmptyDescription>
            </Empty>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
            Live Tracking
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
          </h2>
          <p className="text-sm text-muted-foreground">
            {active.length} active {active.length === 1 ? 'delivery' : 'deliveries'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {active.map(delivery => {
          const driver = drivers.find(d => d.id === delivery.driverId)
          const gps = driverGPS.find(g => g.driverId === delivery.driverId)
          const isAtPickup = delivery.status === 'en_route_pickup'
          const isEnRoute =
            delivery.status === 'picked_up' || delivery.status === 'en_route_dropoff'

          return (
            <Card
              key={delivery.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => setSelectedDeliveryId(delivery.id)}
            >
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {driver ? getInitials(driver.name) : <UserRound className="w-4 h-4" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {driver?.name ?? 'Unassigned driver'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        Order #{delivery.id.slice(-6).toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 ${statusTone(delivery.status)}`}
                  >
                    {statusLabel(delivery.status)}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Pickup</p>
                      <p className="truncate text-foreground">{delivery.pickupAddress}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <Navigation className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">Drop-off</p>
                      <p className="truncate text-foreground">{delivery.dropoffAddress}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {gps
                      ? `Updated ${relativeTime(gps.lastUpdate)}`
                      : isAtPickup
                        ? 'Awaiting pickup'
                        : isEnRoute
                          ? 'In transit'
                          : 'Waiting for driver'}
                  </span>
                  {gps && (
                    <span className="flex items-center gap-1">
                      <Battery className="w-3 h-3" />
                      {gps.battery}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {selectedDelivery && (
        <TrackingDetailSheet
          delivery={selectedDelivery}
          open={Boolean(selectedDeliveryId)}
          onOpenChange={o => !o && setSelectedDeliveryId(null)}
        />
      )}
    </div>
  )
}

function TrackingDetailSheet({
  delivery,
  open,
  onOpenChange,
}: {
  delivery: Delivery
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { drivers, driverGPS } = useApp()
  const driver = drivers.find(d => d.id === delivery.driverId)
  const gps = driverGPS.find(g => g.driverId === delivery.driverId)

  const mapLocations: MapLocation[] = []
  if (delivery.pickupLat && delivery.pickupLng) {
    mapLocations.push({
      lat: delivery.pickupLat,
      lng: delivery.pickupLng,
      label: 'Pickup',
      type: 'pickup',
    })
  }
  if (delivery.dropoffLat && delivery.dropoffLng) {
    mapLocations.push({
      lat: delivery.dropoffLat,
      lng: delivery.dropoffLng,
      label: 'Drop-off',
      type: 'dropoff',
    })
  }

  const driverLocation = gps ? { lat: gps.lat, lng: gps.lng, heading: gps.heading } : undefined
  const canShowMap = mapLocations.length > 0 || Boolean(driverLocation)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[92vh] overflow-y-auto rounded-t-3xl"
      >
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <Radio className="w-5 h-5 text-primary" />
            Tracking order #{delivery.id.slice(-6).toUpperCase()}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {canShowMap ? (
            <DeliveryMap
              locations={mapLocations}
              driverLocation={driverLocation}
              className="h-[260px] w-full rounded-xl overflow-hidden"
            />
          ) : (
            <Card>
              <CardContent className="py-10">
                <Empty>
                  <EmptyMedia>
                    <MapPin className="w-10 h-10 text-muted-foreground" />
                  </EmptyMedia>
                  <EmptyTitle>Map unavailable</EmptyTitle>
                  <EmptyDescription>
                    GPS will appear here once your driver starts moving.
                  </EmptyDescription>
                </Empty>
              </CardContent>
            </Card>
          )}

          {driver && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Driver</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Avatar className="w-11 h-11">
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(driver.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">{driver.name}</p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        <Badge
                          variant="outline"
                          className={statusTone(delivery.status)}
                        >
                          {statusLabel(delivery.status)}
                        </Badge>
                        {gps && <span>· Updated {relativeTime(gps.lastUpdate)}</span>}
                      </p>
                    </div>
                  </div>
                  {driver.phone && (
                    <Button asChild variant="outline" size="sm">
                      <a href={`tel:${driver.phone}`}>
                        <Phone className="w-4 h-4 mr-1" />
                        Call
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">Route</CardTitle>
            </CardHeader>
            <CardContent className="pt-0 space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-green-500" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-foreground">{delivery.pickupAddress}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Navigation className="w-4 h-4 mt-0.5 shrink-0 text-orange-500" />
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Drop-off</p>
                  <p className="text-foreground">{delivery.dropoffAddress}</p>
                </div>
              </div>
              {(delivery.recipientName || delivery.recipientPhone || delivery.buzzCode) && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Recipient</p>
                    {delivery.recipientName && (
                      <p className="text-foreground">{delivery.recipientName}</p>
                    )}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      {delivery.recipientPhone && (
                        <a
                          href={`tel:${delivery.recipientPhone}`}
                          className="flex items-center gap-1 hover:text-primary"
                        >
                          <Phone className="w-3 h-3" />
                          {delivery.recipientPhone}
                        </a>
                      )}
                      {delivery.buzzCode && (
                        <span className="flex items-center gap-1">
                          Buzz {delivery.buzzCode}
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </SheetContent>
    </Sheet>
  )
}
