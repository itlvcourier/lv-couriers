'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getZonesWithGeo,
  createZone,
  updateZone,
  setZonePolygon,
  getZoneParcelCounts,
  getZoneAssignments,
  assignDriverToZone,
  unassignDriverFromZone,
  type ZoneWithGeo,
  type GeoJSONPolygon,
  type ZoneAssignment,
} from '@/lib/zones'
import { loadAllDrivers } from '@/lib/db-extended'
import type { Driver } from '@/lib/types'
import { ZoneDrawMap } from '@/components/maps/ZoneDrawMap'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Pencil,
  Plus,
  Save,
  Undo2,
  X,
  MapPin,
  Trash2,
  Package,
  User,
} from 'lucide-react'

const ZONE_COLORS = [
  '#2563eb', '#16a34a', '#dc2626', '#ea580c', '#0891b2',
  '#7c3aed', '#db2777', '#ca8a04', '#475569', '#0d9488',
]

/** Convert Leaflet [lat,lng] draft points into a closed GeoJSON polygon. */
function draftToPolygon(points: Array<[number, number]>): GeoJSONPolygon | null {
  if (points.length < 3) return null
  const ring = points.map(([lat, lng]) => [lng, lat] as number[])
  // close the ring
  const first = ring[0]
  const last = ring[ring.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]])
  return { type: 'Polygon', coordinates: [ring] }
}

export function AdminZones() {
  const [zones, setZones] = useState<ZoneWithGeo[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [assignments, setAssignments] = useState<ZoneAssignment[]>([])
  const [parcelCounts, setParcelCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState(false)
  const [draftPoints, setDraftPoints] = useState<Array<[number, number]>>([])

  // New-zone dialog
  const [newOpen, setNewOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newColor, setNewColor] = useState(ZONE_COLORS[0])

  const selectedZone = useMemo(
    () => zones.find((z) => z.id === selectedZoneId) ?? null,
    [zones, selectedZoneId],
  )

  const loadAll = useCallback(async () => {
    try {
      const [z, d, a, counts] = await Promise.all([
        getZonesWithGeo(),
        loadAllDrivers(),
        getZoneAssignments(),
        getZoneParcelCounts(),
      ])
      setZones(z)
      setDrivers(d)
      setAssignments(a)
      setParcelCounts(counts)
    } catch (err) {
      console.log('[v0] AdminZones load failed:', (err as Error).message)
      toast.error('Failed to load zones')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  // Refresh live parcel counts periodically.
  useEffect(() => {
    const id = setInterval(() => {
      getZoneParcelCounts().then(setParcelCounts).catch(() => {})
    }, 30_000)
    return () => clearInterval(id)
  }, [])

  const assignmentFor = useCallback(
    (zoneId: string) => assignments.find((a) => a.zoneId === zoneId) ?? null,
    [assignments],
  )

  const startDrawing = (zoneId: string) => {
    setSelectedZoneId(zoneId)
    setDrawing(true)
    const z = zones.find((x) => x.id === zoneId)
    // Seed from existing polygon so editing keeps the current shape.
    if (z?.polygon?.coordinates?.[0]) {
      const ring = z.polygon.coordinates[0]
        .slice(0, -1) // drop closing point for editing
        .map(([lng, lat]) => [lat, lng] as [number, number])
      setDraftPoints(ring)
    } else {
      setDraftPoints([])
    }
  }

  const cancelDrawing = () => {
    setDrawing(false)
    setDraftPoints([])
  }

  const saveDraft = async () => {
    if (!selectedZoneId) return
    const polygon = draftToPolygon(draftPoints)
    if (!polygon) {
      toast.error('Add at least 3 points to form an area')
      return
    }
    setSaving(true)
    try {
      await setZonePolygon(selectedZoneId, polygon)
      toast.success('Zone boundary saved')
      setDrawing(false)
      setDraftPoints([])
      await loadAll()
    } catch (err) {
      console.log('[v0] saveDraft failed:', (err as Error).message)
      toast.error('Failed to save boundary')
    } finally {
      setSaving(false)
    }
  }

  const clearPolygon = async (zoneId: string) => {
    setSaving(true)
    try {
      await setZonePolygon(zoneId, null)
      toast.success('Boundary cleared')
      await loadAll()
    } catch {
      toast.error('Failed to clear boundary')
    } finally {
      setSaving(false)
    }
  }

  const toggleActive = async (zone: ZoneWithGeo) => {
    try {
      await updateZone(zone.id, { isActive: !zone.isActive })
      setZones((zs) =>
        zs.map((z) => (z.id === zone.id ? { ...z, isActive: !z.isActive } : z)),
      )
    } catch {
      toast.error('Failed to update zone')
    }
  }

  const handleAssign = async (zoneId: string, driverId: string) => {
    try {
      if (driverId === '__none__') {
        await unassignDriverFromZone(zoneId)
      } else {
        await assignDriverToZone({ zoneId, driverId })
      }
      const a = await getZoneAssignments()
      setAssignments(a)
      toast.success('Driver assignment updated')
    } catch {
      toast.error('Failed to assign driver')
    }
  }

  const createNewZone = async () => {
    if (!newName.trim()) {
      toast.error('Enter a zone name')
      return
    }
    setSaving(true)
    try {
      const created = await createZone({ name: newName.trim(), color: newColor })
      toast.success(`Created zone "${created.name}"`)
      setNewOpen(false)
      setNewName('')
      setNewColor(ZONE_COLORS[(zones.length + 1) % ZONE_COLORS.length])
      await loadAll()
      // Immediately start drawing the new zone.
      startDrawing(created.id)
    } catch (err) {
      console.log('[v0] createNewZone failed:', (err as Error).message)
      toast.error('Failed to create zone')
    } finally {
      setSaving(false)
    }
  }

  // The Google Drawing Manager reports the whole boundary at once (and again
  // on every vertex edit), so we replace the draft wholesale.
  const handlePolygonComplete = useCallback((points: Array<[number, number]>) => {
    setDraftPoints(points)
  }, [])

  // Discard the current draft so the user can re-draw from scratch.
  const clearDraft = () => setDraftPoints([])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl font-semibold">Zones</h2>
          <p className="text-sm text-muted-foreground">
            Draw delivery territories, assign drivers, and watch live parcel volume.
          </p>
        </div>
        <Button onClick={() => setNewOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New zone
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        {/* Map */}
        <div className="relative h-[420px] lg:h-[640px] rounded-xl overflow-hidden border border-border">
          <ZoneDrawMap
            zones={zones}
            parcelCounts={parcelCounts}
            selectedZoneId={selectedZoneId}
            drawing={drawing}
            draftPoints={draftPoints}
            onPolygonComplete={handlePolygonComplete}
            onSelectZone={(id) => !drawing && setSelectedZoneId(id)}
          />

          {/* Drawing toolbar overlay */}
          {drawing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 rounded-full bg-card/95 backdrop-blur border border-border px-3 py-2 shadow-lg">
              <span className="text-sm font-medium pl-1">
                <MapPin className="inline w-4 h-4 mr-1 text-primary" />
                {draftPoints.length >= 3
                  ? 'Drag vertices to adjust'
                  : 'Use the polygon tool to draw the boundary'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={clearDraft}
                disabled={!draftPoints.length}
              >
                <Undo2 className="w-4 h-4" />
                Redraw
              </Button>
              <Button size="sm" onClick={saveDraft} disabled={saving || draftPoints.length < 3} className="gap-1">
                {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={cancelDrawing}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Zone list / inspector */}
        <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
          {zones.length === 0 && (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              No zones yet. Create one to start drawing territories.
            </div>
          )}

          {zones.map((zone) => {
            const assignment = assignmentFor(zone.id)
            const isSelected = zone.id === selectedZoneId
            const count = parcelCounts[zone.id] ?? 0
            return (
              <div
                key={zone.id}
                className={`rounded-xl border p-3 transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'
                }`}
                onClick={() => !drawing && setSelectedZoneId(zone.id)}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full shrink-0 border border-black/10"
                    style={{ backgroundColor: zone.color }}
                  />
                  <span className="font-medium truncate flex-1">{zone.name}</span>
                  <Badge variant="outline" className="gap-1 shrink-0">
                    <Package className="w-3 h-3" />
                    {count}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    variant="outline"
                    className={
                      zone.polygon
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : 'bg-muted text-muted-foreground'
                    }
                  >
                    {zone.polygon ? 'Has boundary' : 'No boundary'}
                  </Badge>
                  {zone.fsaCodes.length > 0 && (
                    <Badge variant="outline">{zone.fsaCodes.length} FSA</Badge>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto">
                    <span className="text-xs text-muted-foreground">Active</span>
                    <Switch
                      checked={zone.isActive}
                      onCheckedChange={() => toggleActive(zone)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>
                </div>

                {/* Driver assignment */}
                <div className="mt-2 flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground shrink-0" />
                  <Select
                    value={assignment?.driverId ?? '__none__'}
                    onValueChange={(v) => handleAssign(zone.id, v)}
                  >
                    <SelectTrigger className="h-8 text-sm" onClick={(e) => e.stopPropagation()}>
                      <SelectValue placeholder="Assign driver" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {drivers.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Boundary actions */}
                <div className="mt-2 flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1 flex-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      startDrawing(zone.id)
                    }}
                    disabled={drawing}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    {zone.polygon ? 'Edit area' : 'Draw area'}
                  </Button>
                  {zone.polygon && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive gap-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        clearPolygon(zone.id)
                      }}
                      disabled={drawing || saving}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* New zone dialog */}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="zone-name">Zone name</Label>
              <Input
                id="zone-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Downtown Core"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex flex-wrap gap-2">
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={`w-7 h-7 rounded-full border-2 transition-transform ${
                      newColor === c ? 'border-foreground scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c }}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button onClick={createNewZone} disabled={saving} className="gap-2">
              {saving ? <Spinner className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              Create &amp; draw
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
