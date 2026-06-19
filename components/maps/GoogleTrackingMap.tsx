'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { decodePolyline, type LatLng } from '@/lib/google-maps'
import { loadGoogleMaps } from '@/lib/google-maps-loader'

export interface TrackingMapProps {
  /** Driver's current location */
  driverLocation?: LatLng & { heading?: number }
  /** Pickup location */
  pickupLocation?: LatLng & { label?: string }
  /** Dropoff/destination location */
  dropoffLocation?: LatLng & { label?: string }
  /** Encoded polyline for the route (from Directions API) */
  routePolyline?: string
  /** ETA text to show in info window */
  etaText?: string
  /** Driver's current street name */
  driverStreet?: string
  /** Additional CSS classes */
  className?: string
  /** Zoom level (default: auto-fit to markers) */
  zoom?: number
}

/**
 * Google Maps-based tracking map for the recipient tracking page.
 * Shows driver location, pickup/dropoff pins, route line, and ETA.
 */
export function GoogleTrackingMap({
  driverLocation,
  pickupLocation,
  dropoffLocation,
  routePolyline,
  etaText,
  driverStreet,
  className,
  zoom,
}: TrackingMapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<google.maps.Marker[]>([])
  const polylineRef = useRef<google.maps.Polyline | null>(null)
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load Google Maps via the shared loader (single script tag with all
  // libraries) so this map never conflicts with the zone drawing map.
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(() => {
        if (!cancelled) setIsLoaded(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || 'Failed to load Google Maps')
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Initialize map
  useEffect(() => {
    if (!isLoaded || !mapRef.current || mapInstanceRef.current) return

    // Default center (Calgary, AB)
    const defaultCenter = { lat: 51.0447, lng: -114.0719 }
    const center = driverLocation || dropoffLocation || pickupLocation || defaultCenter

    mapInstanceRef.current = new google.maps.Map(mapRef.current, {
      center,
      zoom: zoom || 14,
      disableDefaultUI: true,
      zoomControl: true,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      styles: [
        // Subtle dark mode-friendly styling
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    })

    infoWindowRef.current = new google.maps.InfoWindow()
  }, [isLoaded, driverLocation, dropoffLocation, pickupLocation, zoom])

  // Update markers
  const updateMarkers = useCallback(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null))
    markersRef.current = []

    const bounds = new google.maps.LatLngBounds()
    let hasMarkers = false

    // Driver marker (blue car icon with rotation)
    if (driverLocation) {
      const driverMarker = new google.maps.Marker({
        position: driverLocation,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 6,
          fillColor: '#3B82F6',
          fillOpacity: 1,
          strokeColor: '#1D4ED8',
          strokeWeight: 2,
          rotation: driverLocation.heading || 0,
        },
        title: 'Driver',
        zIndex: 100,
      })

      // Info window with ETA and street
      if (etaText || driverStreet) {
        const content = `
          <div style="padding: 8px; min-width: 120px;">
            <div style="font-weight: 600; color: #3B82F6; margin-bottom: 4px;">Driver</div>
            ${driverStreet ? `<div style="font-size: 12px; color: #666;">On ${driverStreet}</div>` : ''}
            ${etaText ? `<div style="font-size: 14px; font-weight: 500; margin-top: 4px;">${etaText} away</div>` : ''}
          </div>
        `
        driverMarker.addListener('click', () => {
          infoWindowRef.current?.setContent(content)
          infoWindowRef.current?.open(mapInstanceRef.current, driverMarker)
        })
      }

      markersRef.current.push(driverMarker)
      bounds.extend(driverLocation)
      hasMarkers = true
    }

    // Pickup marker (green)
    if (pickupLocation) {
      const pickupMarker = new google.maps.Marker({
        position: pickupLocation,
        map: mapInstanceRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22C55E',
          fillOpacity: 1,
          strokeColor: '#16A34A',
          strokeWeight: 2,
        },
        title: pickupLocation.label || 'Pickup',
        zIndex: 50,
      })

      if (pickupLocation.label) {
        pickupMarker.addListener('click', () => {
          infoWindowRef.current?.setContent(`
            <div style="padding: 8px;">
              <div style="font-weight: 600; color: #22C55E;">Pickup</div>
              <div style="font-size: 12px; color: #666; margin-top: 2px;">${pickupLocation.label}</div>
            </div>
          `)
          infoWindowRef.current?.open(mapInstanceRef.current, pickupMarker)
        })
      }

      markersRef.current.push(pickupMarker)
      bounds.extend(pickupLocation)
      hasMarkers = true
    }

    // Dropoff marker (orange/red destination pin)
    if (dropoffLocation) {
      const dropoffMarker = new google.maps.Marker({
        position: dropoffLocation,
        map: mapInstanceRef.current,
        icon: {
          url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
        },
        title: dropoffLocation.label || 'Destination',
        zIndex: 50,
      })

      if (dropoffLocation.label) {
        dropoffMarker.addListener('click', () => {
          infoWindowRef.current?.setContent(`
            <div style="padding: 8px;">
              <div style="font-weight: 600; color: #EF4444;">Destination</div>
              <div style="font-size: 12px; color: #666; margin-top: 2px;">${dropoffLocation.label}</div>
            </div>
          `)
          infoWindowRef.current?.open(mapInstanceRef.current, dropoffMarker)
        })
      }

      markersRef.current.push(dropoffMarker)
      bounds.extend(dropoffLocation)
      hasMarkers = true
    }

    // Fit bounds to show all markers
    if (hasMarkers && !zoom) {
      mapInstanceRef.current.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 })
      // Don't zoom in too much for single marker
      const listener = google.maps.event.addListener(mapInstanceRef.current, 'idle', () => {
        const currentZoom = mapInstanceRef.current?.getZoom()
        if (currentZoom && currentZoom > 16) {
          mapInstanceRef.current?.setZoom(16)
        }
        google.maps.event.removeListener(listener)
      })
    }
  }, [isLoaded, driverLocation, pickupLocation, dropoffLocation, etaText, driverStreet, zoom])

  // Update route polyline
  const updatePolyline = useCallback(() => {
    if (!mapInstanceRef.current || !isLoaded) return

    // Clear existing polyline
    polylineRef.current?.setMap(null)
    polylineRef.current = null

    if (!routePolyline) return

    const path = decodePolyline(routePolyline)
    if (path.length === 0) return

    polylineRef.current = new google.maps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#3B82F6',
      strokeOpacity: 0.8,
      strokeWeight: 4,
      map: mapInstanceRef.current,
    })
  }, [isLoaded, routePolyline])

  // Apply updates when data changes
  useEffect(() => {
    updateMarkers()
  }, [updateMarkers])

  useEffect(() => {
    updatePolyline()
  }, [updatePolyline])

  if (error) {
    return (
      <div className={cn('flex items-center justify-center bg-muted rounded-xl', className)}>
        <p className="text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  return (
    <div
      ref={mapRef}
      className={cn('w-full rounded-xl overflow-hidden', className)}
      style={{ minHeight: 260 }}
    />
  )
}

// Type declarations
declare global {
  interface Window {
    google: typeof google
  }
}
