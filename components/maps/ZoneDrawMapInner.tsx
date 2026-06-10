'use client'

// Inner Leaflet implementation for the visual zone manager.
// Imported only on the client via ZoneDrawMap (next/dynamic, ssr:false).

import { useEffect, useMemo } from 'react'
import {
  MapContainer,
  TileLayer,
  Polygon,
  Tooltip,
  useMapEvents,
} from 'react-leaflet'
import type { GeoJSONPolygon, ZoneWithGeo } from '@/lib/zones'

export interface ZoneDrawMapProps {
  zones: ZoneWithGeo[]
  parcelCounts: Record<string, number>
  /** Currently selected/edited zone id. */
  selectedZoneId: string | null
  /** When true, map clicks append vertices to the draft polygon. */
  drawing: boolean
  /** Draft polygon vertices as [lat, lng] pairs (Leaflet order). */
  draftPoints: Array<[number, number]>
  onAddPoint: (latlng: [number, number]) => void
  onSelectZone: (zoneId: string) => void
  center?: [number, number]
  zoom?: number
}

/** Convert a GeoJSON polygon ([lng,lat]) to Leaflet positions ([lat,lng]). */
function toLatLng(polygon: GeoJSONPolygon | null): Array<[number, number]> {
  if (!polygon || !polygon.coordinates?.[0]) return []
  return polygon.coordinates[0].map(([lng, lat]) => [lat, lng] as [number, number])
}

function ClickCapture({
  drawing,
  onAddPoint,
}: {
  drawing: boolean
  onAddPoint: (latlng: [number, number]) => void
}) {
  useMapEvents({
    click(e) {
      if (!drawing) return
      onAddPoint([e.latlng.lat, e.latlng.lng])
    },
  })
  return null
}

export default function ZoneDrawMapInner({
  zones,
  parcelCounts,
  selectedZoneId,
  drawing,
  draftPoints,
  onAddPoint,
  onSelectZone,
  center = [36.1699, -115.1398], // Las Vegas default
  zoom = 11,
}: ZoneDrawMapProps) {
  // Inject Leaflet CSS once.
  useEffect(() => {
    const id = 'leaflet-css'
    if (!document.getElementById(id)) {
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
  }, [])

  const savedPolygons = useMemo(
    () =>
      zones
        .filter((z) => z.polygon && z.id !== (drawing ? selectedZoneId : '__none__'))
        .map((z) => ({
          zone: z,
          positions: toLatLng(z.polygon),
          count: parcelCounts[z.id] ?? 0,
        })),
    [zones, parcelCounts, selectedZoneId, drawing],
  )

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '100%', width: '100%' }}
      scrollWheelZoom
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickCapture drawing={drawing} onAddPoint={onAddPoint} />

      {/* Saved zone polygons */}
      {savedPolygons.map(({ zone, positions, count }) =>
        positions.length >= 3 ? (
          <Polygon
            key={zone.id}
            positions={positions}
            pathOptions={{
              color: zone.color,
              weight: zone.id === selectedZoneId ? 4 : 2,
              fillColor: zone.color,
              fillOpacity: zone.id === selectedZoneId ? 0.35 : 0.18,
              opacity: zone.isActive ? 1 : 0.5,
              dashArray: zone.isActive ? undefined : '6 6',
            }}
            eventHandlers={{ click: () => onSelectZone(zone.id) }}
          >
            <Tooltip direction="center" permanent className="zone-count-tooltip">
              <span style={{ fontWeight: 600 }}>{zone.name}</span>
              <br />
              {count} {count === 1 ? 'parcel' : 'parcels'}
            </Tooltip>
          </Polygon>
        ) : null,
      )}

      {/* Draft polygon being drawn/edited */}
      {draftPoints.length >= 2 && (
        <Polygon
          positions={draftPoints}
          pathOptions={{
            color: '#2563eb',
            weight: 3,
            fillColor: '#3b82f6',
            fillOpacity: 0.25,
            dashArray: '4 4',
          }}
        />
      )}
    </MapContainer>
  )
}
