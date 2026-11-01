'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus } from 'lucide-react'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { AddressAutocomplete, type AddressResult } from '@/components/shared/AddressAutocomplete'
import { HandoffRuleFields, validateHandoff, type HandoffValue } from '@/components/shared/HandoffRuleFields'
import { editDeliveryInDb } from '@/lib/db-extended'
import type { Delivery } from '@/lib/types'

interface Props {
  delivery: Delivery | null
  onClose: () => void
  onSaved: (updated: Delivery) => void
}

interface FormState {
  pickupAddress: string
  pickupPostalCode: string
  pickupLat: number | null
  pickupLng: number | null
  dropoffAddress: string
  dropoffPostalCode: string
  dropoffLat: number | null
  dropoffLng: number | null
  recipientName: string
  recipientPhone: string
  buzzCode: string
  recipientNote: string
  smallPackages: number
  bigPackages: number
  packageDescription: string
  isRush: boolean
  isOutOfTown: boolean
  requireSignature: boolean
  requirePhoto: boolean
}

const MAX_QTY = 99

function fromDelivery(d: Delivery): { form: FormState; handoff: HandoffValue } {
  const small = d.manifest.filter(m => m.type === 'small_package').reduce((s, m) => s + m.postedQty, 0)
  const big = d.manifest.filter(m => m.type === 'big_package').reduce((s, m) => s + m.postedQty, 0)
  return {
    form: {
      pickupAddress: d.pickupAddress,
      pickupPostalCode: d.pickupPostalCode ?? '',
      pickupLat: d.pickupLat ?? null,
      pickupLng: d.pickupLng ?? null,
      dropoffAddress: d.dropoffAddress,
      dropoffPostalCode: d.dropoffPostalCode ?? '',
      dropoffLat: d.dropoffLat ?? null,
      dropoffLng: d.dropoffLng ?? null,
      recipientName: d.recipientName ?? '',
      recipientPhone: d.recipientPhone ?? '',
      buzzCode: d.buzzCode ?? '',
      recipientNote: d.recipientNote ?? '',
      smallPackages: small,
      bigPackages: big,
      packageDescription: d.manifest.find(m => m.notes)?.notes ?? '',
      isRush: !!(d.isRush || d.isUrgent),
      isOutOfTown: !!d.isOutOfTown,
      requireSignature: !!d.requireSignature,
      requirePhoto: d.requirePhoto ?? true,
    },
    handoff: {
      handoffRule: d.handoffRule ?? 'door',
      handoffRequireId: !!d.handoffRequireId,
      handoffNamedPerson: d.handoffNamedPerson ?? '',
      handoffNamedRelationship: d.handoffNamedRelationship ?? '',
      handoffLocationNote: d.handoffLocationNote ?? '',
    },
  }
}

async function fetchDistanceKm(f: FormState): Promise<number | null> {
  if (!f.pickupLat || !f.pickupLng || !f.dropoffLat || !f.dropoffLng) return null
  try {
    const res = await fetch(
      `/api/maps/distance?originLat=${f.pickupLat}&originLng=${f.pickupLng}&destLat=${f.dropoffLat}&destLng=${f.dropoffLng}`,
    )
    if (!res.ok) return null
    const data = await res.json()
    return typeof data.distanceKm === 'number' ? data.distanceKm : null
  } catch {
    return null
  }
}

function Stepper({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <Label htmlFor={id} className="text-sm">{label}</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`Fewer ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))} disabled={value <= 0}>
          <Minus className="h-4 w-4" aria-hidden="true" />
        </Button>
        <Input id={id} inputMode="numeric" className="h-8 w-14 text-center" value={value}
          onChange={e => {
            const n = parseInt(e.target.value.replace(/\D/g, ''), 10)
            onChange(Number.isFinite(n) ? Math.min(MAX_QTY, n) : 0)
          }} />
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label={`More ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(MAX_QTY, value + 1))} disabled={value >= MAX_QTY}>
          <Plus className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

export function EditDeliverySheet({ delivery, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState | null>(null)
  const [handoff, setHandoff] = useState<HandoffValue | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!delivery) return
    const init = fromDelivery(delivery)
    setForm(init.form)
    setHandoff(init.handoff)
  }, [delivery])

  const set = <K extends keyof FormState>(key: K, v: FormState[K]) =>
    setForm(prev => (prev ? { ...prev, [key]: v } : prev))

  const save = async () => {
    if (!delivery || !form || !handoff || saving) return
    if (!form.pickupAddress.trim() || !form.dropoffAddress.trim()) {
      toast.error('Pickup and delivery addresses are required')
      return
    }
    if (form.smallPackages + form.bigPackages === 0) {
      toast.error('Add at least one package')
      return
    }
    const handoffError = validateHandoff(handoff)
    if (handoffError) {
      toast.error(handoffError)
      return
    }

    setSaving(true)
    try {
      const addressChanged =
        form.pickupLat !== (delivery.pickupLat ?? null) || form.pickupLng !== (delivery.pickupLng ?? null) ||
        form.dropoffLat !== (delivery.dropoffLat ?? null) || form.dropoffLng !== (delivery.dropoffLng ?? null)
      const distanceKm = addressChanged ? await fetchDistanceKm(form) : delivery.distanceKm ?? null

      const updated = await editDeliveryInDb(delivery.id, {
        pickupAddress: form.pickupAddress.trim(),
        pickupPostalCode: form.pickupPostalCode.trim().toUpperCase() || null,
        pickupLat: form.pickupLat,
        pickupLng: form.pickupLng,
        dropoffAddress: form.dropoffAddress.trim(),
        dropoffArea: form.dropoffAddress.split(',')[1]?.trim() || delivery.dropoffArea || 'Calgary',
        dropoffPostalCode: form.dropoffPostalCode.trim().toUpperCase() || null,
        dropoffLat: form.dropoffLat,
        dropoffLng: form.dropoffLng,
        recipientName: form.recipientName.trim() || null,
        recipientPhone: form.recipientPhone.trim() || null,
        buzzCode: form.buzzCode.trim() || null,
        recipientNote: form.recipientNote.trim() || null,
        isRush: form.isRush,
        isOutOfTown: form.isOutOfTown,
        requireSignature: form.requireSignature,
        requirePhoto: form.requirePhoto,
        handoffRule: handoff.handoffRule,
        handoffRequireId: handoff.handoffRequireId,
        handoffNamedPerson: handoff.handoffNamedPerson.trim() || null,
        handoffNamedRelationship: handoff.handoffNamedRelationship.trim() || null,
        handoffLocationNote: handoff.handoffLocationNote.trim() || null,
        distanceKm,
        smallPackages: form.smallPackages,
        bigPackages: form.bigPackages,
        packageDescription: form.packageDescription.trim() || null,
      })
      toast.success('Delivery updated')
      onSaved(updated)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not update delivery')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Sheet open={!!delivery} onOpenChange={open => !open && !saving && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Edit delivery</SheetTitle>
          <SheetDescription>
            Everything from New Delivery can be changed until a courier starts the order.
          </SheetDescription>
        </SheetHeader>

        {form && handoff && (
          <div className="flex flex-col gap-6 px-4 pb-6">
            <section aria-labelledby="edit-pickup" className="flex flex-col gap-3">
              <h3 id="edit-pickup" className="text-sm font-semibold text-foreground">Pickup</h3>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-pickupAddress">Pickup address *</Label>
                <AddressAutocomplete
                  id="edit-pickupAddress"
                  value={form.pickupAddress}
                  onChange={v => setForm(p => (p ? { ...p, pickupAddress: v, pickupLat: null, pickupLng: null } : p))}
                  onSelect={(r: AddressResult) =>
                    setForm(p => (p ? {
                      ...p,
                      pickupAddress: r.address,
                      pickupLat: r.lat ?? null,
                      pickupLng: r.lng ?? null,
                      pickupPostalCode: r.components?.postalCode || p.pickupPostalCode,
                    } : p))
                  }
                  placeholder="Enter pickup address"
                  required
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-pickupPostal">Postal code</Label>
                <Input id="edit-pickupPostal" maxLength={7} className="uppercase tracking-wider"
                  value={form.pickupPostalCode} onChange={e => set('pickupPostalCode', e.target.value.toUpperCase())} />
              </div>
            </section>

            <section aria-labelledby="edit-dropoff" className="flex flex-col gap-3">
              <h3 id="edit-dropoff" className="text-sm font-semibold text-foreground">Delivery</h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-recipientName">Recipient name</Label>
                  <Input id="edit-recipientName" maxLength={80} value={form.recipientName}
                    onChange={e => set('recipientName', e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-recipientPhone">Recipient phone</Label>
                  <Input id="edit-recipientPhone" type="tel" autoComplete="tel" maxLength={20} value={form.recipientPhone}
                    onChange={e => set('recipientPhone', e.target.value)} />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-dropoffAddress">Delivery address *</Label>
                <AddressAutocomplete
                  id="edit-dropoffAddress"
                  value={form.dropoffAddress}
                  onChange={v => setForm(p => (p ? { ...p, dropoffAddress: v, dropoffLat: null, dropoffLng: null } : p))}
                  onSelect={(r: AddressResult) =>
                    setForm(p => (p ? {
                      ...p,
                      dropoffAddress: r.address,
                      dropoffLat: r.lat ?? null,
                      dropoffLng: r.lng ?? null,
                      dropoffPostalCode: r.components?.postalCode || p.dropoffPostalCode,
                    } : p))
                  }
                  placeholder="Enter delivery address"
                  required
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-dropoffPostal">Postal code</Label>
                  <Input id="edit-dropoffPostal" maxLength={7} className="uppercase tracking-wider"
                    value={form.dropoffPostalCode} onChange={e => set('dropoffPostalCode', e.target.value.toUpperCase())} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="edit-buzz">Buzz code</Label>
                  <Input id="edit-buzz" maxLength={20} value={form.buzzCode} onChange={e => set('buzzCode', e.target.value)} />
                </div>
              </div>
            </section>

            <section aria-labelledby="edit-packages" className="flex flex-col gap-3">
              <h3 id="edit-packages" className="text-sm font-semibold text-foreground">Packages</h3>
              <Stepper id="edit-small" label="Small packages" value={form.smallPackages} onChange={n => set('smallPackages', n)} />
              <Stepper id="edit-big" label="Large packages" value={form.bigPackages} onChange={n => set('bigPackages', n)} />
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-pkgDesc">Package description</Label>
                <Input id="edit-pkgDesc" maxLength={500} value={form.packageDescription}
                  onChange={e => set('packageDescription', e.target.value)} />
              </div>
            </section>

            <section aria-labelledby="edit-options" className="flex flex-col gap-4">
              <h3 id="edit-options" className="text-sm font-semibold text-foreground">Options</h3>
              {([
                ['isRush', 'Rush delivery', 'Prioritized in dispatch'],
                ['isOutOfTown', 'Out of town', 'Outside the city service area'],
                ['requireSignature', 'Require signature', 'Recipient signs on the courier phone'],
                ['requirePhoto', 'Require photo', 'Courier takes a proof photo at handoff'],
              ] as const).map(([key, label, hint]) => (
                <div key={key} className="flex items-center justify-between gap-4">
                  <div className="flex flex-col">
                    <Label htmlFor={`edit-${key}`}>{label}</Label>
                    <span className="text-xs text-muted-foreground">{hint}</span>
                  </div>
                  <Switch id={`edit-${key}`} checked={form[key]} onCheckedChange={c => set(key, c)} />
                </div>
              ))}
            </section>

            <section aria-label="Handoff" className="flex flex-col gap-3">
              <HandoffRuleFields value={handoff} onChange={setHandoff} idPrefix="edit-handoff" />
            </section>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-note">Special instructions</Label>
              <Textarea id="edit-note" rows={3} maxLength={1000} value={form.recipientNote}
                onChange={e => set('recipientNote', e.target.value)} placeholder="Notes for the courier" />
            </div>

            <p className="text-xs leading-relaxed text-muted-foreground">
              Price is recalculated from your rate card when the courier confirms pickup.
            </p>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button className="flex-1" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
