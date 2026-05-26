'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState, useMemo } from 'react'
import { Card } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import {
  Phone,
  Check,
  X,
  Clock,
  Truck,
  CheckCircle,
  MapPin,
  Navigation,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import dynamic from 'next/dynamic'

// Dynamically import map to avoid SSR issues
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false }
)
const TileLayer = dynamic(
  () => import('react-leaflet').then((mod) => mod.TileLayer),
  { ssr: false }
)
const Marker = dynamic(
  () => import('react-leaflet').then((mod) => mod.Marker),
  { ssr: false }
)
const Popup = dynamic(
  () => import('react-leaflet').then((mod) => mod.Popup),
  { ssr: false }
)

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
  driver_id: string | null
  business: { name: string } | null
  driver: { name: string; phone: string | null } | null
}

interface DriverLocation {
  lat: number
  lng: number
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
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // Load leaflet CSS on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
      setMapReady(true)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    const load = async () => {
      const { data, error } = await supabase
        .from('deliveries')
        .select(
          `id, status, recipient_name, dropoff_address, delivered_at,
           picked_up_at, posted_at, claimed_at, en_route_dropoff_at,
           proof_photo_url, signature_url, recipient_note, driver_id,
           dropoff_lat, dropoff_lng, pickup_lat, pickup_lng,
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

      // Load driver GPS if there's a driver assigned
      if (data.driver_id) {
        const { data: gpsData } = await supabase
          .from('driver_locations')
          .select('lat, lng, recorded_at')
          .eq('driver_id', data.driver_id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (gpsData && !cancelled) {
          setDriverLocation({
            lat: Number(gpsData.lat),
            lng: Number(gpsData.lng),
            recorded_at: gpsData.recorded_at,
          })
        }
      }
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
        () => {
          if (cancelled) return
          // Reload full delivery with joins when status changes
          void load()
        },
      )
      .subscribe()

    // Subscribe to driver GPS updates (separate channel, filtered by driver_id dynamically)
    let gpsChannel: ReturnType<typeof supabase.channel> | null = null
    const setupGpsChannel = (driverId: string) => {
      if (gpsChannel) {
        void supabase.removeChannel(gpsChannel)
      }
      gpsChannel = supabase
        .channel(`driver-gps-${driverId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'driver_locations',
            filter: `driver_id=eq.${driverId}`,
          },
          (payload: { new: { lat: string; lng: string; recorded_at: string } }) => {
            if (cancelled) return
            const p = payload.new
            setDriverLocation({
              lat: Number(p.lat),
              lng: Number(p.lng),
              recorded_at: p.recorded_at,
            })
          },
        )
        .subscribe()
    }

    // Set up GPS channel once we have delivery data with driver_id
    const checkAndSetupGps = async () => {
      const { data } = await supabase
        .from('deliveries')
        .select('driver_id')
        .eq('id', code)
        .maybeSingle()
      if (data?.driver_id && !cancelled) {
        setupGpsChannel(data.driver_id)
      }
    }
    void checkAndSetupGps()

    // Fallback polling every 15s for GPS updates (more frequent than status)
    const interval = setInterval(load, 15000)

    return () => {
      cancelled = true
      clearInterval(interval)
      void supabase.removeChannel(channel)
      if (gpsChannel) void supabase.removeChannel(gpsChannel)
    }
  }, [code])

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
  const showLiveMap = mapReady && 
    driverLocation && 
    ['en_route_pickup', 'picked_up', 'en_route_dropoff'].includes(delivery.status)

  // Calculate map center and bounds
  const mapCenter = useMemo(() => {
    if (driverLocation) return { lat: driverLocation.lat, lng: driverLocation.lng }
    if (delivery.dropoff_lat && delivery.dropoff_lng) {
      return { lat: Number(delivery.dropoff_lat), lng: Number(delivery.dropoff_lng) }
    }
    return { lat: 53.5461, lng: -113.4938 } // Edmonton default
  }, [driverLocation, delivery.dropoff_lat, delivery.dropoff_lng])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TrackingHeader />

      <main className="flex-1 p-4 max-w-2xl mx-auto w-full">
        {/* Hero - Live Map or Status Card */}
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
          ) : showLiveMap ? (
            <Card className="overflow-hidden">
              <div className="h-[260px] md:h-[320px] relative">
                <MapContainer
                  center={[mapCenter.lat, mapCenter.lng]}
                  zoom={14}
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  {/* Driver marker */}
                  {driverLocation && (
                    <Marker position={[driverLocation.lat, driverLocation.lng]}>
                      <Popup>
                        <div className="text-center">
                          <p className="font-medium">{delivery.driver?.name || 'Driver'}</p>
                          <p className="text-xs text-muted-foreground">
                            Updated {formatRelativeTime(driverLocation.recorded_at)}
                          </p>
                        </div>
                      </Popup>
                    </Marker>
                  )}
                  {/* Dropoff marker */}
                  {delivery.dropoff_lat && delivery.dropoff_lng && (
                    <Marker position={[Number(delivery.dropoff_lat), Number(delivery.dropoff_lng)]}>
                      <Popup>Delivery destination</Popup>
                    </Marker>
                  )}
                </MapContainer>
                {/* Status overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                  <div className="flex items-center gap-3 text-white">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                      <Navigation className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium">{headlineForStatus(delivery.status)}</p>
                      <p className="text-xs text-white/70">
                        Live tracking · Updated {formatRelativeTime(driverLocation?.recorded_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
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
                  className="w-full rounded-md object-cover max-h-[400px]"
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

function formatRelativeTime(iso?: string | null): string {
  if (!iso) return ''
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const secs = Math.floor(diff / 1000)
  if (secs < 60) return 'just now'
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}
