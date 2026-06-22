'use client'

// Google Maps implementation for the visual zone manager (§12).
// Loaded client-only via ZoneDrawMap (next/dynamic, ssr:false).
//
// Capabilities:
//  - Google base map centered on Calgary with a Map/Satellite toggle.
//  - Existing zone polygons rendered with their color + click-to-select.
//  - Manual drawing mode (the Maps Drawing Library / DrawingManager was removed
//    in v3.65): click the map to add boundary vertices, then drag vertices to
//    fine-tune. Completed/edited paths are reported up via onPolygonComplete as
//    [lat,lng] pairs.
//  - A Places search box to jump the map to an address/neighbourhood.

import { useEffect, useRef, useState } from 'react'
import { Search } from 'lucide-react'
import { loadGoogleMaps } from '@/lib/google-maps-loader'
import type { GeoJSONPolygon, ZoneWithGeo } from '@/lib/zones'

export interface ZoneDrawMapProps {
  zones: ZoneWithGeo[]
  parcelCounts: Record<string, number>
  /** Currently selected/edited zone id. */
  selectedZoneId: string | null
  /** When true, the user can draw/edit the draft boundary. */
  drawing: boolean
  /** Draft polygon vertices as [lat, lng] pairs. */
  draftPoints: Array<[number, number]>
  /** Reports the full draft path whenever it is drawn or edited. */
  onPolygonComplete: (points: Array<[number, number]>) => void
  onSelectZone: (zoneId: string) => void
  center?: [number, number]
  zoom?: number
}

/** GeoJSON polygon ([lng,lat]) -> google LatLngLiteral[] ([lat,lng]). */
function toPath(polygon: GeoJSONPolygon | null): google.maps.LatLngLiteral[] {
  if (!polygon || !polygon.coordinates?.[0]) return []
  return polygon.coordinates[0].map(([lng, lat]) => ({ lat, lng }))
}

function pathToPoints(path: google.maps.MVCArray<google.maps.LatLng>): Array<[number, number]> {
  const out: Array<[number, number]> = []
  path.forEach((p) => out.push([p.lat(), p.lng()]))
  return out
}

/**
 * A centroid text label rendered via OverlayView instead of the deprecated
 * `google.maps.Marker`. OverlayView needs no Map ID (unlike AdvancedMarker),
 * so it works on a standard raster map without extra GCP configuration.
 * Defined lazily because it extends a class that only exists after the Maps
 * script has loaded.
 */
function createZoneLabel(
  map: google.maps.Map,
  position: google.maps.LatLng,
  text: string,
  color: string,
): google.maps.OverlayView {
  class ZoneLabel extends google.maps.OverlayView {
    private div: HTMLDivElement | null = null
    onAdd() {
      const div = document.createElement('div')
      div.className = 'zone-map-label'
      div.textContent = text
      div.style.position = 'absolute'
      div.style.transform = 'translate(-50%, -50%)'
      div.style.color = color
      div.style.fontSize = '12px'
      div.style.fontWeight = '600'
      div.style.whiteSpace = 'nowrap'
      div.style.pointerEvents = 'none'
      this.div = div
      this.getPanes()?.overlayMouseTarget.appendChild(div)
    }
    draw() {
      if (!this.div) return
      const pt = this.getProjection()?.fromLatLngToDivPixel(position)
      if (pt) {
        this.div.style.left = `${pt.x}px`
        this.div.style.top = `${pt.y}px`
      }
    }
    onRemove() {
      this.div?.remove()
      this.div = null
    }
  }
  const label = new ZoneLabel()
  label.setMap(map)
  return label
}

export default function ZoneDrawMapInner({
  zones,
  parcelCounts,
  selectedZoneId,
  drawing,
  draftPoints,
  onPolygonComplete,
  onSelectZone,
  center = [51.0447, -114.0719], // Calgary, AB
  zoom = 11,
}: ZoneDrawMapProps) {
  const mapEl = useRef<HTMLDivElement>(null)
  const searchEl = useRef<HTMLInputElement>(null)
  const mapRef = useRef<google.maps.Map | null>(null)
  const savedPolysRef = useRef<google.maps.Polygon[]>([])
  const labelsRef = useRef<google.maps.OverlayView[]>([])
  const draftPolyRef = useRef<google.maps.Polygon | null>(null)
  const drawClickRef = useRef<google.maps.MapsEventListener | null>(null)

  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Keep the latest callback without re-running effects.
  const onCompleteRef = useRef(onPolygonComplete)
  onCompleteRef.current = onPolygonComplete
  const onSelectRef = useRef(onSelectZone)
  onSelectRef.current = onSelectZone

  // --- Initialize the map + Places search once. ---
  useEffect(() => {
    let cancelled = false
    loadGoogleMaps()
      .then(() => {
        if (cancelled || !mapEl.current) return
        const map = new google.maps.Map(mapEl.current, {
          center: { lat: center[0], lng: center[1] },
          zoom,
          mapTypeControl: true, // Map / Satellite toggle
          mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'hybrid'],
            position: google.maps.ControlPosition.TOP_RIGHT,
          },
          streetViewControl: false,
          fullscreenControl: false,
          clickableIcons: false,
        })
        mapRef.current = map

        // The legacy Places Autocomplete widget is unavailable to Google Maps
        // customers created after March 1, 2025 and can throw on construction.
        // Wrap it so a failure in this optional search box never blocks the map
        // (and its drawing tools) from rendering.
        if (searchEl.current) {
          try {
            const ac = new google.maps.places.Autocomplete(searchEl.current, {
              fields: ['geometry'],
              componentRestrictions: { country: 'ca' },
            })
            ac.bindTo('bounds', map)
            ac.addListener('place_changed', () => {
              const place = ac.getPlace()
              if (!place.geometry) return
              if (place.geometry.viewport) {
                map.fitBounds(place.geometry.viewport)
              } else if (place.geometry.location) {
                map.setCenter(place.geometry.location)
                map.setZoom(14)
              }
            })
          } catch (err) {
            console.warn('[v0] Zone search box unavailable (legacy Autocomplete):', err)
          }
        }

        setReady(true)
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Render saved zone polygons (skip the one being edited). ---
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    savedPolysRef.current.forEach((p) => p.setMap(null))
    labelsRef.current.forEach((m) => m.setMap(null))
    savedPolysRef.current = []
    labelsRef.current = []

    for (const zone of zones) {
      if (!zone.polygon) continue
      if (drawing && zone.id === selectedZoneId) continue // edited separately
      const path = toPath(zone.polygon)
      if (path.length < 3) continue

      const isSel = zone.id === selectedZoneId
      const poly = new google.maps.Polygon({
        paths: path,
        strokeColor: zone.color,
        strokeWeight: isSel ? 4 : 2,
        strokeOpacity: zone.isActive ? 1 : 0.5,
        fillColor: zone.color,
        fillOpacity: isSel ? 0.35 : 0.18,
        clickable: !drawing,
        map,
      })
      poly.addListener('click', () => onSelectRef.current(zone.id))
      savedPolysRef.current.push(poly)

      // Centroid label with zone name + live parcel count.
      const bounds = new google.maps.LatLngBounds()
      path.forEach((pt) => bounds.extend(pt))
      const count = parcelCounts[zone.id] ?? 0
      const label = createZoneLabel(
        map,
        bounds.getCenter(),
        `${zone.name} · ${count}`,
        zone.color,
      )
      labelsRef.current.push(label)
    }
  }, [ready, zones, parcelCounts, selectedZoneId, drawing])

  // --- Drawing / editing the draft boundary. ---
  useEffect(() => {
    if (!ready || !mapRef.current) return
    const map = mapRef.current

    // Tear down any previous draft artifacts.
    const teardown = () => {
      if (drawClickRef.current) {
        drawClickRef.current.remove()
        drawClickRef.current = null
      }
      if (draftPolyRef.current) {
        draftPolyRef.current.setMap(null)
        draftPolyRef.current = null
      }
    }

    if (!drawing) {
      teardown()
      return
    }

    const attachEditListeners = (poly: google.maps.Polygon) => {
      const path = poly.getPath()
      if (!path) return
      const report = () => onCompleteRef.current(pathToPoints(path))
      path.addListener('set_at', report)
      path.addListener('insert_at', report)
      path.addListener('remove_at', report)
    }

    if (draftPoints.length >= 3) {
      // Edit existing shape: render an editable polygon, no drawing manager.
      teardown()
      const poly = new google.maps.Polygon({
        paths: draftPoints.map(([lat, lng]) => ({ lat, lng })),
        strokeColor: '#2563eb',
        strokeWeight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        editable: true,
        draggable: false,
        map,
      })
      draftPolyRef.current = poly
      attachEditListeners(poly)
    } else {
      // Fresh draw: the DrawingManager was removed from the Maps JS API in
      // v3.65, so we draw manually. Each map click appends a vertex to an
      // editable polygon; the user can then drag vertices to fine-tune. The
      // path is reported on every click and on every subsequent edit.
      teardown()
      // Start with an explicit (empty) MVCArray path. Constructing a Polygon
      // with `paths: []` leaves getPath() undefined until vertices exist, so we
      // assign the path up-front to safely attach edit listeners and push to it.
      const path = new google.maps.MVCArray<google.maps.LatLng>()
      const poly = new google.maps.Polygon({
        strokeColor: '#2563eb',
        strokeWeight: 3,
        fillColor: '#3b82f6',
        fillOpacity: 0.25,
        editable: true,
        draggable: false,
        map,
      })
      poly.setPath(path)
      draftPolyRef.current = poly
      attachEditListeners(poly)

      drawClickRef.current = map.addListener(
        'click',
        (e: google.maps.MapMouseEvent) => {
          if (!e.latLng) return
          path.push(e.latLng)
          onCompleteRef.current(pathToPoints(path))
        },
      )
    }

    return teardown
    // We intentionally only react to `drawing` toggling and whether a seed
    // shape exists, not to every draftPoints change (which we emit ourselves).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, drawing, selectedZoneId])

  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/50 p-6 text-center text-sm text-muted-foreground">
        {error.includes('API_KEY')
          ? 'Google Maps API key is not configured.'
          : `Map failed to load: ${error}`}
      </div>
    )
  }

  return (
    <div className="relative h-full w-full">
      {/* Places search */}
      <div className="absolute left-1/2 top-3 z-10 w-[min(90%,420px)] -translate-x-1/2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            ref={searchEl}
            type="text"
            placeholder="Search for a place to center the map…"
            className="h-10 w-full rounded-full border border-border bg-card/95 pl-9 pr-4 text-sm shadow-lg outline-none backdrop-blur placeholder:text-muted-foreground focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </div>
      <div ref={mapEl} className="h-full w-full" />
    </div>
  )
}
