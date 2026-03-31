'use client'

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { Spinner } from '@/components/ui/spinner'

// Dynamically import map component to avoid SSR issues
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
const Polyline = dynamic(
  () => import('react-leaflet').then((mod) => mod.Polyline),
  { ssr: false }
)

export interface MapLocation {
  lat: number
  lng: number
  label?: string
  type: 'pickup' | 'dropoff' | 'driver' | 'stop'
}

interface DeliveryMapProps {
  locations: MapLocation[]
  driverLocation?: { lat: number; lng: number; heading?: number }
  showRoute?: boolean
  className?: string
}

export function DeliveryMap({ 
  locations, 
  driverLocation, 
  showRoute = true,
  className = 'h-[300px] w-full rounded-xl overflow-hidden'
}: DeliveryMapProps) {
  const [isMounted, setIsMounted] = useState(false)
  const [L, setL] = useState<typeof import('leaflet') | null>(null)

  useEffect(() => {
    setIsMounted(true)
    import('leaflet').then((leaflet) => {
      setL(leaflet.default)
    })
  }, [])

  if (!isMounted || !L) {
    return (
      <div className={`${className} bg-muted/50 flex items-center justify-center`}>
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  // Calculate center from all locations
  const allPoints = [
    ...locations.map(l => [l.lat, l.lng]),
    ...(driverLocation ? [[driverLocation.lat, driverLocation.lng]] : [])
  ]
  
  const center = allPoints.length > 0 
    ? [
        allPoints.reduce((sum, p) => sum + p[0], 0) / allPoints.length,
        allPoints.reduce((sum, p) => sum + p[1], 0) / allPoints.length
      ] as [number, number]
    : [36.1699, -115.1398] as [number, number] // Default to Las Vegas

  // Create route polyline points
  const routePoints = showRoute && locations.length > 1
    ? locations.map(l => [l.lat, l.lng] as [number, number])
    : []

  // Custom icons
  const createIcon = (color: string, label?: string) => {
    return L.divIcon({
      className: 'custom-marker',
      html: `
        <div style="
          background-color: ${color};
          width: 32px;
          height: 32px;
          border-radius: 50% 50% 50% 0;
          transform: rotate(-45deg);
          border: 3px solid white;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          ${label ? `<span style="transform: rotate(45deg); color: white; font-weight: bold; font-size: 12px;">${label}</span>` : ''}
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32],
    })
  }

  const driverIcon = L.divIcon({
    className: 'driver-marker',
    html: `
      <div style="
        background-color: #3b82f6;
        width: 36px;
        height: 36px;
        border-radius: 50%;
        border: 4px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
        transform: rotate(${driverLocation?.heading || 0}deg);
      ">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/>
        </svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
  })

  return (
    <div className={className}>
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
        integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
        crossOrigin=""
      />
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Route line */}
        {routePoints.length > 1 && (
          <Polyline
            positions={routePoints}
            color="#3b82f6"
            weight={4}
            opacity={0.7}
            dashArray="10, 10"
          />
        )}

        {/* Location markers */}
        {locations.map((location, index) => {
          const color = location.type === 'pickup' ? '#22c55e' : 
                       location.type === 'dropoff' ? '#ef4444' : '#f97316'
          const label = locations.length > 2 ? String(index + 1) : undefined
          
          return (
            <Marker
              key={`${location.lat}-${location.lng}-${index}`}
              position={[location.lat, location.lng]}
              icon={createIcon(color, label)}
            >
              {location.label && (
                <Popup>
                  <div className="text-sm font-medium">{location.label}</div>
                  <div className="text-xs text-gray-500 capitalize">{location.type}</div>
                </Popup>
              )}
            </Marker>
          )
        })}

        {/* Driver marker */}
        {driverLocation && (
          <Marker
            position={[driverLocation.lat, driverLocation.lng]}
            icon={driverIcon}
          >
            <Popup>
              <div className="text-sm font-medium">Driver Location</div>
              <div className="text-xs text-gray-500">Live tracking</div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    </div>
  )
}
