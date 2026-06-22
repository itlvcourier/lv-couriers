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
  Eraser,
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

/** Spherical area of a lat/lng polygon, in square kilometres. */
function polygonAreaKm2(points: Array<[number, number]>): number {
  if (points.length < 3) return 0
  const R = 6378137 // Earth radius in metres
  const toRad = (d: number) => (d * Math.PI) / 180
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [lat1, lng1] = points[i]
    const [lat2, lng2] = points[(i + 1) % points.length]
    area += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)))
  }
  area = (area * R * R) / 2
  return Math.abs(area) / 1e6
}

/** Validate a Canadian Forward Sortation Area code, e.g. "T2P". */
function isValidFsa(code: string): boolean {
  return /^[A-Za-z]\d[A-Za-z]$/.test(code.trim())
}

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
  // Incrementing command signals consumed by the map (undo / clear vertices).
  const [undoSignal, setUndoSignal] = useState(0)
  const [clearSignal, setClearSignal] = useState(0)
  // Per-zone FSA code input drafts, keyed by zone id.
  const [fsaInputs, setFsaInputs] = useState<Record<string, string>>({})

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

  // Remove the last placed vertex / clear all vertices via map command signals.
  const undoPoint = () => setUndoSignal((n) => n + 1)
  const clearDraft = () => setClearSignal((n) => n + 1)

  // Double-click on the map finishes the boundary -> save if it's valid.
  const finishDrawing = useCallback(() => {
    if (draftPoints.length >= 3) void saveDraft()
    else toast.error('Add at least 3 points to form an area')
    // saveDraft is stable enough for this handler; deps kept minimal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftPoints.length])

  // Keyboard shortcuts while drawing: Enter saves, Esc cancels, Ctrl/Cmd+Z undo.
  useEffect(() => {
    if (!drawing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        finishDrawing()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelDrawing()
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        undoPoint()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawing, finishDrawing])

  // Live readout of the in-progress boundary.
  const draftAreaKm2 = useMemo(() => polygonAreaKm2(draftPoints), [draftPoints])

  // --- FSA (postal-code) management per zone. ---
  const saveFsaCodes = async (zoneId: string, codes: string[]) => {
    // De-dupe + normalise to uppercase 3-char FSAs.
    const next = Array.from(new Set(codes.map((c) => c.trim().toUpperCase())))
    try {
      await updateZone(zoneId, { fsaCodes: next })
      setZones((zs) => zs.map((z) => (z.id === zoneId ? { ...z, fsaCodes: next } : z)))
    } catch {
      toast.error('Failed to update postal codes')
    }
  }

  const addFsaCode = (zone: ZoneWithGeo) => {
    const raw = (fsaInputs[zone.id] ?? '').trim().toUpperCase()
    if (!isValidFsa(raw)) {
      toast.error('Enter a valid FSA, e.g. T2P')
      return
    }
    if (zone.fsaCodes.includes(raw)) {
      toast.error(`${raw} is already in this zone`)
      return
    }
    void saveFsaCodes(zone.id, [...zone.fsaCodes, raw])
    setFsaInputs((m) => ({ ...m, [zone.id]: '' }))
  }

  const removeFsaCode = (zone: ZoneWithGeo, code: string) => {
    void saveFsaCodes(zone.id, zone.fsaCodes.filter((c) => c !== code))
  }

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
            undoSignal={undoSignal}
            clearSignal={clearSignal}
            onFinish={finishDrawing}
          />

          {/* Drawing toolbar overlay */}
          {drawing && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex flex-col items-center gap-1.5 rounded-2xl bg-card/95 backdrop-blur border border-border px-3 py-2 shadow-lg">
              <div className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="inline w-4 h-4 text-primary" />
                <span>
                  {draftPoints.length === 0
                    ? 'Click the map to place boundary points'
                    : draftPoints.length < 3
                      ? `${draftPoints.length} point${draftPoints.length === 1 ? '' : 's'} — add ${3 - draftPoints.length} more`
                      : 'Double-click or press Enter to finish'}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="gap-1 tabular-nums">
                  {draftPoints.length} pts
                </Badge>
                {draftPoints.length >= 3 && (
                  <Badge variant="outline" className="gap-1 tabular-nums">
                    {draftAreaKm2 < 1
                      ? `${Math.round(draftAreaKm2 * 100) / 100} km²`
                      : `${Math.round(draftAreaKm2 * 10) / 10} km²`}
                  </Badge>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={undoPoint}
                  disabled={!draftPoints.length}
                  title="Undo last point (Ctrl/Cmd+Z)"
                >
                  <Undo2 className="w-4 h-4" />
                  Undo
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={clearDraft}
                  disabled={!draftPoints.length}
                >
                  <Eraser className="w-4 h-4" />
                  Clear
                </Button>
                <Button
                  size="sm"
                  onClick={saveDraft}
                  disabled={saving || draftPoints.length < 3}
                  className="gap-1"
                >
                  {saving ? <Spinner className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelDrawing} title="Cancel (Esc)">
                  <X className="w-4 h-4" />
                </Button>
              </div>
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

                {/* Postal-code (FSA) coverage — used as a fallback when an
                    address falls outside every drawn boundary. */}
                <div className="mt-2 border-t border-border pt-2" onClick={(e) => e.stopPropagation()}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      Postal codes (FSA)
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {zone.fsaCodes.map((code) => (
                      <Badge key={code} variant="secondary" className="gap-1 pr-1">
                        {code}
                        <button
                          type="button"
                          onClick={() => removeFsaCode(zone, code)}
                          className="rounded-full hover:bg-foreground/10 p-0.5"
                          aria-label={`Remove ${code}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={fsaInputs[zone.id] ?? ''}
                        onChange={(e) =>
                          setFsaInputs((m) => ({ ...m, [zone.id]: e.target.value }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault()
                            addFsaCode(zone)
                          }
                        }}
                        placeholder="T2P"
                        maxLength={3}
                        className="h-7 w-16 text-sm uppercase"
                      />
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2"
                        onClick={() => addFsaCode(zone)}
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
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
