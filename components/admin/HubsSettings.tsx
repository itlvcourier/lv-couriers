'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Warehouse, Plus, Trash2, Save, Star, Clock, MapPin } from 'lucide-react'
import {
  type Hub,
  getHubs,
  createHub,
  updateHub,
  deleteHub,
  setDefaultHub,
} from '@/lib/hubs'
import { invalidateHubs } from '@/lib/hooks/useHubs'

/** Format "HH:MM" -> "2:00 PM" for display. */
function formatSortTime(t: string | null): string | null {
  if (!t) return null
  const m = /^(\d{2}):(\d{2})/.exec(t)
  if (!m) return t
  let h = parseInt(m[1], 10)
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}:${m[2]} ${ampm}`
}

interface DraftHub {
  name: string
  address: string
  sortTime: string
  isDefault: boolean
}

const EMPTY_DRAFT: DraftHub = { name: '', address: '', sortTime: '', isDefault: false }

export function HubsSettings() {
  const [hubs, setHubs] = useState<Hub[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<DraftHub>(EMPTY_DRAFT)
  const [savingId, setSavingId] = useState<string | null>(null)
  // Per-row local edits keyed by hub id.
  const [edits, setEdits] = useState<Record<string, { address: string; sortTime: string }>>({})

  const load = async () => {
    try {
      const data = await getHubs(true)
      setHubs(data)
      setEdits(
        Object.fromEntries(
          data.map((h) => [h.id, { address: h.address ?? '', sortTime: h.sortTime ?? '' }]),
        ),
      )
    } catch {
      toast.error('Could not load hubs')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  const handleAdd = async () => {
    if (!draft.name.trim()) {
      toast.error('Hub name is required')
      return
    }
    setAdding(true)
    try {
      await createHub({
        name: draft.name.trim(),
        address: draft.address.trim() || null,
        sortTime: draft.sortTime || null,
        isDefault: draft.isDefault,
      })
      invalidateHubs()
      setDraft(EMPTY_DRAFT)
      await load()
      toast.success('Hub added')
    } catch {
      toast.error('Could not add hub')
    } finally {
      setAdding(false)
    }
  }

  const handleSaveRow = async (hub: Hub) => {
    const edit = edits[hub.id]
    if (!edit) return
    setSavingId(hub.id)
    try {
      await updateHub(hub.id, {
        address: edit.address.trim() || null,
        sortTime: edit.sortTime || null,
      })
      invalidateHubs()
      await load()
      toast.success('Hub updated')
    } catch {
      toast.error('Could not update hub')
    } finally {
      setSavingId(null)
    }
  }

  const handleSetDefault = async (hub: Hub) => {
    try {
      await setDefaultHub(hub.id)
      invalidateHubs()
      await load()
      toast.success(`${hub.name} is now the default hub`)
    } catch {
      toast.error('Could not set default hub')
    }
  }

  const handleToggleActive = async (hub: Hub) => {
    try {
      await updateHub(hub.id, { isActive: !hub.isActive })
      invalidateHubs()
      await load()
      toast.success(hub.isActive ? 'Hub deactivated' : 'Hub activated')
    } catch {
      toast.error('Could not update hub')
    }
  }

  const handleDelete = async (hub: Hub) => {
    try {
      await deleteHub(hub.id)
      invalidateHubs()
      await load()
      toast.success('Hub removed')
    } catch {
      toast.error('Could not remove hub (it may still be referenced by parcels)')
    }
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Warehouse className="w-5 h-5 text-[var(--accent-orange)]" />
          Cross-Dock Hubs
        </CardTitle>
        <CardDescription>
          The meet points where cross-dock parcels are sorted. Drivers see the default hub&apos;s
          address and sort time when carrying a parcel to the hub.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading hubs...</p>
        ) : (
          <>
            {hubs.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No hubs yet. Add one below so cross-dock parcels have a meet point.
              </p>
            )}

            {hubs.map((hub) => {
              const edit = edits[hub.id] ?? { address: '', sortTime: '' }
              return (
                <div
                  key={hub.id}
                  className={`p-4 rounded-xl border ${
                    hub.isActive
                      ? 'border-[var(--border-color)] bg-[var(--bg-card-2)]'
                      : 'border-[var(--border-color)] bg-[var(--bg-card-2)] opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-foreground truncate">{hub.name}</p>
                      {hub.isDefault && (
                        <Badge className="bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] border-[var(--accent-orange)]/30 gap-1">
                          <Star className="w-3 h-3" />
                          Default
                        </Badge>
                      )}
                      {!hub.isActive && <Badge variant="outline">Inactive</Badge>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {!hub.isDefault && hub.isActive && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetDefault(hub)}
                          className="h-8 text-xs"
                        >
                          Make default
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleActive(hub)}
                        className="h-8 text-xs"
                      >
                        {hub.isActive ? 'Deactivate' : 'Activate'}
                      </Button>
                      {!hub.isDefault && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(hub)}
                          className="h-8 w-8 text-[var(--accent-red)]"
                          aria-label={`Delete ${hub.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3 h-3" /> Address
                      </Label>
                      <Input
                        value={edit.address}
                        onChange={(e) =>
                          setEdits((p) => ({ ...p, [hub.id]: { ...edit, address: e.target.value } }))
                        }
                        placeholder="123 Hub St, City"
                        className="bg-[var(--bg-card)] border-[var(--border-color)]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs flex items-center gap-1 text-muted-foreground">
                        <Clock className="w-3 h-3" /> Sort time
                      </Label>
                      <Input
                        type="time"
                        value={edit.sortTime}
                        onChange={(e) =>
                          setEdits((p) => ({ ...p, [hub.id]: { ...edit, sortTime: e.target.value } }))
                        }
                        className="bg-[var(--bg-card)] border-[var(--border-color)]"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-3">
                    <p className="text-xs text-muted-foreground">
                      {hub.sortTime
                        ? `Drivers meet by ${formatSortTime(hub.sortTime)}`
                        : 'No scheduled sort time'}
                    </p>
                    <Button
                      size="sm"
                      onClick={() => handleSaveRow(hub)}
                      disabled={savingId === hub.id}
                      className="h-8 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
                    >
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                      {savingId === hub.id ? 'Saving...' : 'Save'}
                    </Button>
                  </div>
                </div>
              )
            })}

            {/* Add new hub */}
            <div className="p-4 rounded-xl border border-dashed border-[var(--border-color)]">
              <p className="text-sm font-medium text-foreground mb-3 flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add a hub
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="hub-name" className="text-xs text-muted-foreground">
                    Name
                  </Label>
                  <Input
                    id="hub-name"
                    value={draft.name}
                    onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Main Hub"
                    className="bg-[var(--bg-card)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="hub-time" className="text-xs text-muted-foreground">
                    Sort time
                  </Label>
                  <Input
                    id="hub-time"
                    type="time"
                    value={draft.sortTime}
                    onChange={(e) => setDraft((p) => ({ ...p, sortTime: e.target.value }))}
                    className="bg-[var(--bg-card)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="hub-address" className="text-xs text-muted-foreground">
                    Address
                  </Label>
                  <Input
                    id="hub-address"
                    value={draft.address}
                    onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                    placeholder="123 Hub St, City"
                    className="bg-[var(--bg-card)] border-[var(--border-color)]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.isDefault}
                    onChange={(e) => setDraft((p) => ({ ...p, isDefault: e.target.checked }))}
                    className="accent-[var(--accent-orange)]"
                  />
                  Set as default hub
                </label>
                <Button
                  size="sm"
                  onClick={handleAdd}
                  disabled={adding}
                  className="h-9 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  {adding ? 'Adding...' : 'Add Hub'}
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
