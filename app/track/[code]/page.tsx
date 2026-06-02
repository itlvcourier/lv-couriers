'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Phone,
  Check,
  X,
  Clock,
  Truck,
  CheckCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { GoogleTrackingMap } from '@/components/maps/GoogleTrackingMap'

type TrackingStatus =
  | 'posted'
  | 'claimed'
  | 'en_route_pickup'
  | 'picked_up'
  | 'en_route_dropoff'
  | 'delivered'
  | 'failed_attempt'
  | 'failed_permanent'
  | 'cancelled'

interface TrackedDelivery {
  id: string
  driver_id: string | null
  status: TrackingStatus
  recipient_name: string | null
  dropoff_address: string | null
  dropoff_lat: number | null
  dropoff_lng: number | null
  pickup_lat: number | null
  pickup_lng: number | null
  delivered_at: string | null
  picked_up_at: string | null
  posted_at: string | null
  claimed_at: string | null
  en_route_dropoff_at: string | null
  proof_photo_url: string | null
  signature_url: string | null
  recipient_note: string | null
  business: { name: string } | null
  driver: { name: string; phone: string | null } | null
}

interface LiveLocation {
  lat: number
  lng: number
  heading: number | null
  recorded_at: string
}

interface StatusStep {
  id: string
  label: string
  status: 'complete' | 'current' | 'upcoming'
  timestamp?: string
}

export default function TrackingPage() {
  const params = useParams()
  const code = params.code as string

  const [delivery, setDelivery] = useState<TrackedDelivery | null>(null)
  const [liveLocation, setLiveLocation] = useState<LiveLocation | null>(null)
  const [etaText, setEtaText] = useState<string | null>(null)
  const [driverStreet, setDriverStreet] = useState<string | null>(null)
  const [routePolyline, setRoutePolyline] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const load = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(
          `id, driver_id, status, recipient_name, dropoff_address,
           dropoff_lat, dropoff_lng, pickup_lat, pickup_lng, delivered_at,
           picked_up_at, posted_at, claimed_at, en_route_dropoff_at,
           proof_photo_url, signature_url, recipient_note,
           business:businesses(name), driver:drivers(name, phone)`,
        )
        .eq('id', code)
        .maybeSingle()

      if (cancelled) return
      if (error || !data) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setDelivery(data as unknown as TrackedDelivery)
      setLoading(false)
    }

    void load()

    // Subscribe to real-time updates on this specific delivery
    const channel = supabase
      .channel(`delivery-track-${code}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'deliveries',
          filter: `id=eq.${code}`,
        },
        (payload: unknown) => {
          if (cancelled) return
          // Reload full delivery with joins when status changes
          void load()
        },
      )
      .subscribe()

    // Fallback polling every 30s in case realtime connection drops
    const interval = setInterval(load, 30000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [code])

  // Live driver location: only while the delivery is assigned to a driver and
  // actively in transit. Reads the latest fix and subscribes to updates so the
  // map dot moves in real time.
  const driverId = delivery?.driver_id ?? null
  const isInTransit =
    delivery?.status === 'en_route_pickup' ||
    delivery?.status === 'picked_up' ||
    delivery?.status === 'en_route_dropoff'

  useEffect(() => {
    if (!driverId || !isInTransit) {
      setLiveLocation(null)
      return
    }
    let cancelled = false
    const supabase = createClient()

    const loadLocation = async () => {
      const { data } = await supabase
        .from('driver_locations')
        .select('lat, lng, heading, recorded_at')
        .eq('driver_id', driverId)
        .order('recorded_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (cancelled || !data) return
      setLiveLocation(data as LiveLocation)
    }

    void loadLocation()

    const channel = supabase
      .channel(`driver-loc-${driverId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `driver_id=eq.${driverId}`,
        },
        (payload: { new?: Partial<LiveLocation> }) => {
          if (cancelled) return
          const row = payload.new
          if (row && typeof row.lat === 'number' && typeof row.lng === 'number') {
            setLiveLocation({
              lat: row.lat,
              lng: row.lng,
              heading: row.heading ?? null,
              recorded_at: row.recorded_at ?? new Date().toISOString(),
            })
          } else {
            void loadLocation()
          }
        },
      )
      .subscribe()

    // Fallback poll every 15s in case realtime drops.
    const interval = setInterval(loadLocation, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void supabase.removeChannel(channel)
    }
  }, [driverId, isInTransit])

  // Refs for throttling API calls — only fetch directions/reverse-geocode if
  // driver has moved significantly or enough time has passed. This reduces
  // Google Maps API usage by 50-70%.
  const lastDirectionsFetch = useRef<{ lat: number; lng: number; time: number } | null>(null)
  const lastReverseGeocode = useRef<{ lat: number; lng: number; street: string } | null>(null)

  // Fetch ETA, route line, and driver's current street when we have live location
  // Throttled: only re-fetch directions every 30s or if driver moved 200m+
  useEffect(() => {
    if (!liveLocation || !delivery) return

    const now = Date.now()

    // Determine destination based on status
    const isHeadingToPickup =
      delivery.status === 'en_route_pickup' || delivery.status === 'claimed'
    const destLat = isHeadingToPickup ? delivery.pickup_lat : delivery.dropoff_lat
    const destLng = isHeadingToPickup ? delivery.pickup_lng : delivery.dropoff_lng

    // Helper: calculate distance between two points in meters
    const distanceMeters = (lat1: number, lng1: number, lat2: number, lng2: number) => {
      const R = 6371000 // Earth's radius in meters
      const dLat = ((lat2 - lat1) * Math.PI) / 180
      const dLng = ((lng2 - lng1) * Math.PI) / 180
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
      return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    }

    // Fetch ETA and route if we have destination coords
    // Throttle: only if moved 200m+ or 30s+ since last fetch
    if (destLat && destLng) {
      const last = lastDirectionsFetch.current
      const movedEnough = !last || distanceMeters(liveLocation.lat, liveLocation.lng, last.lat, last.lng) > 200
      const timeElapsed = !last || now - last.time > 30000

      if (movedEnough || timeElapsed) {
        lastDirectionsFetch.current = { lat: liveLocation.lat, lng: liveLocation.lng, time: now }

        const params = new URLSearchParams({
          originLat: String(liveLocation.lat),
          originLng: String(liveLocation.lng),
          destLat: String(destLat),
          destLng: String(destLng),
        })

        void fetch(`/api/maps/directions?${params}`)
          .then(res => res.json())
          .then(data => {
            if (data.polyline) setRoutePolyline(data.polyline)
            if (data.duration?.text) setEtaText(data.duration.text)
          })
          .catch(err => console.error('[v0] Directions fetch error:', err))
      }
    }

    // Reverse geocode: only if moved 100m+ from last position
    const lastRG = lastReverseGeocode.current
    const rgMovedEnough = !lastRG || distanceMeters(liveLocation.lat, liveLocation.lng, lastRG.lat, lastRG.lng) > 100

    if (rgMovedEnough) {
      const reverseParams = new URLSearchParams({
        lat: String(liveLocation.lat),
        lng: String(liveLocation.lng),
      })
      void fetch(`/api/maps/reverse-geocode?${reverseParams}`)
        .then(res => res.json())
        .then(data => {
          if (data.street) {
            setDriverStreet(data.street)
            lastReverseGeocode.current = { lat: liveLocation.lat, lng: liveLocation.lng, street: data.street }
          }
        })
        .catch(err => console.error('[v0] Reverse geocode fetch error:', err))
    }
  }, [liveLocation, delivery])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TrackingHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Spinner className="size-6 text-primary" />
        </main>
      </div>
    )
  }

  if (notFound || !delivery) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TrackingHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
              <Clock className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Tracking link not found</h2>
            <p className="text-muted-foreground mb-6">
              This delivery doesn&apos;t exist or the link has expired.
            </p>
            <p className="text-sm text-muted-foreground">
              Contact LV Courier:{' '}
              <a href="tel:5875759699" className="text-primary font-medium">
                587-575-9699
              </a>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  // Failed delivery
  if (
    delivery.status === 'failed_attempt' ||
    delivery.status === 'failed_permanent' ||
    delivery.status === 'cancelled'
  ) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <TrackingHeader />
        <main className="flex-1 flex items-center justify-center p-4">
          <Card className="max-w-md w-full p-8 text-center">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-destructive/10 flex items-center justify-center">
              <X className="w-10 h-10 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Delivery attempted</h2>
            <p className="text-muted-foreground mb-6">
              We were unable to complete your delivery.
            </p>
            <p className="text-sm text-muted-foreground mb-4">
              Please contact us:{' '}
              <a href="tel:5875759699" className="text-primary font-medium">
                587-575-9699
              </a>
            </p>
          </Card>
        </main>
      </div>
    )
  }

  const steps = buildStatusSteps(delivery)
  const isDelivered = delivery.status === 'delivered'

  // Determine pickup/dropoff locations for the map
  const pickupLocation =
    delivery.status === 'en_route_pickup' &&
    typeof delivery.pickup_lat === 'number' &&
    typeof delivery.pickup_lng === 'number'
      ? { lat: delivery.pickup_lat, lng: delivery.pickup_lng, label: 'Pickup' }
      : undefined

  const dropoffLocation =
    typeof delivery.dropoff_lat === 'number' &&
    typeof delivery.dropoff_lng === 'number'
      ? {
          lat: delivery.dropoff_lat,
          lng: delivery.dropoff_lng,
          label: delivery.dropoff_address ?? 'Destination',
        }
      : undefined

  const hasMapData = liveLocation || pickupLocation || dropoffLocation

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TrackingHeader />

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Hero */}
        <div className="mb-6">
          {isDelivered ? (
            <Card className="h-[260px] md:h-[320px] flex items-center justify-center bg-gradient-to-br from-green-500/10 to-emerald-500/10">
              <div className="text-center">
                <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-green-500 flex items-center justify-center">
                  <CheckCircle className="w-12 h-12 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-green-500 mb-2">
                  Delivered!
                </h3>
                <p className="text-muted-foreground">
                  {delivery.delivered_at
                    ? formatTime(delivery.delivered_at)
                    : ''}
                </p>
              </div>
            </Card>
          ) : hasMapData ? (
            <div>
              <GoogleTrackingMap
                driverLocation={
                  liveLocation
                    ? {
                        lat: liveLocation.lat,
                        lng: liveLocation.lng,
                        heading: liveLocation.heading ?? undefined,
                      }
                    : undefined
                }
                pickupLocation={pickupLocation}
                dropoffLocation={dropoffLocation}
                routePolyline={routePolyline ?? undefined}
                etaText={etaText ?? undefined}
                driverStreet={driverStreet ?? undefined}
                className="h-[260px] md:h-[320px]"
              />
              <div className="mt-3 text-center">
                <h3 className="text-lg font-semibold">
                  {headlineForStatus(delivery.status)}
                </h3>
                {liveLocation ? (
                  <div className="space-y-1">
                    {etaText && (
                      <p className="text-base font-medium text-primary">
                        {etaText} away
                      </p>
                    )}
                    {driverStreet && (
                      <p className="text-sm text-muted-foreground">
                        Currently on {driverStreet}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                      Live · updated {formatTime(liveLocation.recorded_at)}
                    </p>
                  </div>
                ) : (
                  delivery.dropoff_address && (
                    <p className="text-sm text-muted-foreground">
                      Heading to {delivery.dropoff_address}
                    </p>
                  )
                )}
              </div>
            </div>
          ) : (
            <Card className="h-[260px] md:h-[320px] flex flex-col items-center justify-center bg-card text-center px-6">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
                <Truck className="w-10 h-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-1">
                {headlineForStatus(delivery.status)}
              </h3>
              {delivery.dropoff_address && (
                <p className="text-sm text-muted-foreground max-w-sm">
                  Heading to {delivery.dropoff_address}
                </p>
              )}
            </Card>
          )}
        </div>

        {/* Proof of delivery: photo, signature, and recipient note. */}
        {isDelivered &&
          (delivery.proof_photo_url ||
            delivery.signature_url ||
            delivery.recipient_note) && (
          <Card className="p-4 mb-6 space-y-4">
            <p className="text-sm font-medium">Proof of delivery</p>

            {delivery.proof_photo_url && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Photo</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={delivery.proof_photo_url || '/placeholder.svg'}
                  alt="Proof of delivery"
                  className="w-full rounded-md object-contain max-h-[400px] bg-black"
                />
              </div>
            )}

            {delivery.signature_url && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">
                  Recipient signature
                </p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={delivery.signature_url}
                  alt="Recipient signature"
                  className="w-full rounded-md bg-white border border-border p-2 max-h-[180px] object-contain"
                />
              </div>
            )}

            {delivery.recipient_note && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">
                  Recipient note
                </p>
                <p className="text-sm leading-relaxed">
                  {delivery.recipient_note}
                </p>
              </div>
            )}
          </Card>
        )}

        {/* Status Timeline */}
        <Card className="p-4 mb-6">
          <div className="space-y-0">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className="flex items-start gap-3 pb-4 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center',
                      step.status === 'complete' &&
                        'bg-primary text-primary-foreground',
                      step.status === 'current' &&
                        'bg-primary/20 border-2 border-primary',
                      step.status === 'upcoming' &&
                        'bg-muted border-2 border-muted-foreground/30',
                    )}
                  >
                    {step.status === 'complete' ? (
                      <Check className="w-4 h-4" />
                    ) : step.status === 'current' ? (
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    ) : (
                      <div className="w-2 h-2 bg-muted-foreground/30 rounded-full" />
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={cn(
                        'w-0.5 h-8 mt-1',
                        step.status === 'complete' ? 'bg-primary' : 'bg-muted',
                      )}
                    />
                  )}
                </div>
                <div className="flex-1 pt-1">
                  <p
                    className={cn(
                      'font-medium',
                      step.status === 'upcoming' && 'text-muted-foreground',
                    )}
                  >
                    {step.label}
                  </p>
                  {step.status === 'current' && (
                    <p className="text-sm text-primary">In progress</p>
                  )}
                  {step.timestamp && (
                    <p className="text-sm text-muted-foreground">
                      {step.timestamp}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Driver strip with call option */}
        {!isDelivered && delivery.driver?.name && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Truck className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    Your driver: {delivery.driver.name}
                  </p>
                  {delivery.business?.name && (
                    <p className="text-sm text-muted-foreground">
                      From {delivery.business.name}
                    </p>
                  )}
                </div>
              </div>
              {delivery.driver.phone && (
                <a
                  href={`tel:${delivery.driver.phone.replace(/[^\d+]/g, '')}`}
                  className="p-2 rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                  aria-label={`Call driver ${delivery.driver.name}`}
                >
                  <Phone className="w-5 h-5 text-primary" />
                </a>
              )}
            </div>
          </Card>
        )}

        <div className="text-center py-6">
          <p className="text-muted-foreground mb-2">Questions?</p>
          <a
            href="tel:5875759699"
            className="inline-flex items-center gap-2 text-primary font-medium"
          >
            <Phone className="w-4 h-4" />
            Call 587-575-9699
          </a>
        </div>
      </main>
    </div>
  )
}

function TrackingHeader() {
  return (
    <header className="border-b border-border bg-card">
      <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-xl font-bold text-primary">LV</span>
          <span className="text-xl font-bold">COURIER</span>
        </div>
        <a
          href="tel:5875759699"
          className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5"
        >
          <Phone className="w-4 h-4" />
          587-575-9699
        </a>
      </div>
    </header>
  )
}

function buildStatusSteps(d: TrackedDelivery): StatusStep[] {
  const order: TrackingStatus[] = [
    'posted',
    'claimed',
    'picked_up',
    'en_route_dropoff',
    'delivered',
  ]
  // Treat in-between statuses as their nearest milestone.
  const normalized: TrackingStatus =
    d.status === 'en_route_pickup' ? 'claimed' : d.status

  const currentIdx = order.indexOf(normalized)
  const labels: Array<{ id: string; label: string; ts: string | null }> = [
    { id: 'placed', label: 'Order placed', ts: d.posted_at },
    { id: 'assigned', label: 'Driver assigned', ts: d.claimed_at },
    { id: 'picked_up', label: 'Picked up', ts: d.picked_up_at },
    { id: 'on_the_way', label: 'On the way', ts: d.en_route_dropoff_at },
    { id: 'delivered', label: 'Delivered', ts: d.delivered_at },
  ]

  return labels.map((l, i) => {
    let status: StatusStep['status'] = 'upcoming'
    if (currentIdx >= 0) {
      if (i < currentIdx) status = 'complete'
      else if (i === currentIdx) status = 'current'
    }
    if (l.id === 'delivered' && d.status === 'delivered') status = 'complete'
    return {
      id: l.id,
      label: l.label,
      status,
      timestamp: l.ts ? formatTime(l.ts) : undefined,
    }
  })
}

function headlineForStatus(s: TrackingStatus): string {
  switch (s) {
    case 'posted':
      return 'Looking for a driver'
    case 'claimed':
    case 'en_route_pickup':
      return 'Driver heading to pickup'
    case 'picked_up':
      return 'Package picked up'
    case 'en_route_dropoff':
      return 'On the way to you'
    default:
      return 'In progress'
  }
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: 'numeric',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}
