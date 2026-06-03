'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import { useApp } from '@/lib/context'
import { calculateBreakdown } from '@/lib/billing'
import { BillingBreakdownCard } from '@/components/shared/CostCalculator'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { RecipientPicker } from '@/components/business/RecipientPicker'
import { AddressAutocomplete, type AddressResult } from '@/components/shared/AddressAutocomplete'
import { toast } from 'sonner'
import {
  MapPin,
  Package,
  Clock,
  AlertCircle,
  Truck,
  Copy,
  FilePlus,
  X,
  UserRound,
  BookmarkPlus,
  CheckCircle2,
  Ruler,
  Loader2,
} from 'lucide-react'
import type { ManifestItem, Delivery, SavedContact } from '@/lib/types'

interface CreateOrderFormProps {
  onSuccess?: () => void
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const {
    currentUser,
    businesses,
    postDelivery,
    checkDuplicateAddress,
    combineDeliveries,
    upsertSavedContact,
    getRateCardForLocation,
    activeLocationId,
    isOwner,
    getAccessibleLocations,
  } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateDelivery, setDuplicateDelivery] = useState<Delivery | null>(null)
  const [pendingManifest, setPendingManifest] = useState<ManifestItem[]>([])
  const [fromSavedContactId, setFromSavedContactId] = useState<string | null>(null)

  const business = businesses.find(b => b.id === currentUser?.businessId)
  const userIsOwner = isOwner()
  const accessibleLocations = getAccessibleLocations()
  
  // Determine which location to use for posting
  // - If owner and "all" is selected, default to first location
  // - If specific location is selected, use that
  // - If non-owner, use their only accessible location
  const effectiveLocationId = 
    activeLocationId && activeLocationId !== 'all' 
      ? activeLocationId 
      : accessibleLocations[0]?.id || currentUser?.locationId
      
  const location = business?.locations.find(l => l.id === effectiveLocationId)
  const businessId = currentUser?.businessId || ''

  const initialFormState = {
    pickupAddress: location?.address || '',
    pickupPostalCode: '',
    pickupContact: location?.phone || '',
    pickupLat: null as number | null,
    pickupLng: null as number | null,
    recipientName: '',
    dropoffAddress: '',
    dropoffPostalCode: '',
    dropoffContact: '',
    dropoffLat: null as number | null,
    dropoffLng: null as number | null,
    buzzCode: '',
    saveContact: true,
    packageDescription: '',
    specialInstructions: '',
    requireSignature: false,
    requirePhoto: true,
    smallPackages: 0,
    bigPackages: 1,
    isRush: false,
    isOutOfTown: false,
  }

  const [form, setForm] = useState(initialFormState)
  const [distanceKm, setDistanceKm] = useState<number | null>(null)
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false)

  // Live billing preview — uses postedQty (not yet picked up) and recalculates
  // every time the manifest or rush/OOT flags change.
  const rateCard = effectiveLocationId ? getRateCardForLocation(effectiveLocationId) : null
  const isDistanceBased = rateCard?.useRadiusPricing && (rateCard.radiusTiers?.length ?? 0) > 0
  
  // Calculate distance when we have both pickup and dropoff coordinates
  // This runs for all businesses (to show distance) but is also used for billing when radius pricing is enabled
  const calculateDistance = useCallback(async () => {
    // Need both pickup and dropoff coordinates
    const originLat = location?.lat ?? form.pickupLat
    const originLng = location?.lng ?? form.pickupLng
    const destLat = form.dropoffLat
    const destLng = form.dropoffLng
    
    if (!originLat || !originLng || !destLat || !destLng) {
      setDistanceKm(null)
      return
    }
    
    setIsCalculatingDistance(true)
    try {
      const res = await fetch(
        `/api/maps/distance?originLat=${originLat}&originLng=${originLng}&destLat=${destLat}&destLng=${destLng}`
      )
      if (res.ok) {
        const data = await res.json()
        setDistanceKm(data.distanceKm)
      } else {
        setDistanceKm(null)
      }
    } catch (e) {
      console.error('[v0] Failed to calculate distance:', e)
      setDistanceKm(null)
    } finally {
      setIsCalculatingDistance(false)
    }
  }, [location?.lat, location?.lng, form.pickupLat, form.pickupLng, form.dropoffLat, form.dropoffLng])
  
  // Trigger distance calculation when dropoff coordinates change
  useEffect(() => {
    if (form.dropoffLat && form.dropoffLng) {
      calculateDistance()
    } else {
      setDistanceKm(null)
    }
  }, [form.dropoffLat, form.dropoffLng, calculateDistance])
  
  const previewBreakdown = useMemo(() => {
    const previewManifest = [
      ...(form.smallPackages > 0
        ? [{
            id: 'preview-small',
            type: 'small_package' as const,
            postedQty: form.smallPackages,
            confirmedQty: null,
            verificationPhotoUrl: null,
            notes: '',
          }]
        : []),
      ...(form.bigPackages > 0
        ? [{
            id: 'preview-big',
            type: 'big_package' as const,
            postedQty: form.bigPackages,
            confirmedQty: null,
            verificationPhotoUrl: null,
            notes: '',
          }]
        : []),
    ]
    return calculateBreakdown(previewManifest, form.isOutOfTown, form.isRush, rateCard, false, distanceKm)
  }, [form.smallPackages, form.bigPackages, form.isOutOfTown, form.isRush, rateCard, distanceKm])

  const hasPackages = form.smallPackages + form.bigPackages > 0

  const resetForm = () => {
    setForm({
      ...initialFormState,
      pickupAddress: location?.address || '',
      pickupContact: location?.phone || '',
    })
    setFromSavedContactId(null)
  }

  const handleSelectContact = (contact: SavedContact) => {
    setForm(prev => ({
      ...prev,
      recipientName: contact.name,
      dropoffAddress: contact.address,
      dropoffContact: contact.phone || '',
      buzzCode: contact.buzzCode || '',
      // Don't re-save a recipient that came from the address book
      saveContact: false,
    }))
    setFromSavedContactId(contact.id)
    toast.success(`Filled from ${contact.name}`)
  }

  const clearRecipient = () => {
    setForm(prev => ({
      ...prev,
      recipientName: '',
      dropoffAddress: '',
      dropoffPostalCode: '',
      dropoffContact: '',
      buzzCode: '',
      saveContact: true,
    }))
    setFromSavedContactId(null)
  }

  const createManifestItems = (): ManifestItem[] => {
    const items: ManifestItem[] = []

    if (form.smallPackages > 0) {
      items.push({
        id: `item-${Date.now()}-small`,
        type: 'small_package',
        postedQty: form.smallPackages,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: form.packageDescription,
      })
    }

    if (form.bigPackages > 0) {
      items.push({
        id: `item-${Date.now()}-big`,
        type: 'big_package',
        postedQty: form.bigPackages,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: form.packageDescription,
      })
    }

    if (form.isRush) {
      items.push({
        id: `item-${Date.now()}-rush`,
        type: 'rush',
        postedQty: 1,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: '',
      })
    }

    if (form.isOutOfTown) {
      items.push({
        id: `item-${Date.now()}-oot`,
        type: 'out_of_town',
        postedQty: 1,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: '',
      })
    }

    return items
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      if (!form.pickupAddress || !form.dropoffAddress) {
        throw new Error('Please fill in the pickup and delivery addresses')
      }
      if (form.smallPackages + form.bigPackages === 0) {
        throw new Error('Please add at least one package')
      }

      const manifest = createManifestItems()

      const duplicate = checkDuplicateAddress(
        form.dropoffAddress,
        currentUser?.businessId || '',
        currentUser?.locationId || '',
      )

      if (duplicate) {
        setDuplicateDelivery(duplicate)
        setPendingManifest(manifest)
        setShowDuplicateModal(true)
        setIsSubmitting(false)
        return
      }

      await postNewDelivery(manifest)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const maybeSaveContact = () => {
    // Save if there's a name (required) and either:
    //  - user opted in via checkbox, OR
    //  - this came from an existing contact (bumps useCount + lastUsedAt)
    const name = form.recipientName.trim()
    const address = form.dropoffAddress.trim()
    if (!name || !address) return
    if (!form.saveContact && !fromSavedContactId) return

    upsertSavedContact({
      businessId,
      name,
      address,
      phone: form.dropoffContact.trim() || null,
      buzzCode: form.buzzCode.trim() || null,
      area: address.split(',')[1]?.trim() || null,
    })
  }

  const postNewDelivery = async (manifest: ManifestItem[]) => {
    maybeSaveContact()

    postDelivery({
      businessId,
      locationId: currentUser?.locationId || '',
      businessName: business?.name || '',
      pickupAddress: form.pickupAddress,
      pickupArea: location?.name || '',
      pickupPostalCode: form.pickupPostalCode.trim().toUpperCase() || null,
      pickupLat: form.pickupLat,
      pickupLng: form.pickupLng,
      dropoffAddress: form.dropoffAddress,
      dropoffArea: form.dropoffAddress.split(',')[1]?.trim() || 'Calgary',
      dropoffPostalCode: form.dropoffPostalCode.trim().toUpperCase() || null,
      dropoffLat: form.dropoffLat,
      dropoffLng: form.dropoffLng,
      recipientName: form.recipientName.trim() || null,
      recipientPhone: form.dropoffContact.trim() || null,
      buzzCode: form.buzzCode.trim() || null,
      manifest,
      isUrgent: form.isRush,
      isOutOfTown: form.isOutOfTown,
      requireSignature: form.requireSignature,
      requirePhoto: form.requirePhoto,
      distanceKm: distanceKm,
    })

    resetForm()
    toast.success('Delivery posted successfully!')
    onSuccess?.()
  }

  const handleCombineWithExisting = () => {
    if (duplicateDelivery && pendingManifest.length > 0) {
      maybeSaveContact()
      combineDeliveries(duplicateDelivery.id, pendingManifest)
      toast.success('Items added to existing delivery')
      setShowDuplicateModal(false)
      setDuplicateDelivery(null)
      setPendingManifest([])
      resetForm()
      onSuccess?.()
    }
  }

  const handleKeepSeparate = async () => {
    setShowDuplicateModal(false)
    setDuplicateDelivery(null)
    await postNewDelivery(pendingManifest)
    setPendingManifest([])
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 pb-8 overflow-x-hidden">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold mb-1">Create New Delivery</h2>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Fill in the delivery details below
          </p>
        </div>

        {error && (
          <Card className="border-destructive bg-destructive/10">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
              <p className="text-sm text-destructive">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* Pickup Details */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <MapPin className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-primary" />
              </div>
              Pickup Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6 pt-0">
            <div className="space-y-2">
              <Label htmlFor="pickupAddress">Pickup Address *</Label>
              <AddressAutocomplete
                id="pickupAddress"
                value={form.pickupAddress}
                onChange={(value) => setForm(prev => ({ ...prev, pickupAddress: value }))}
                onSelect={(result: AddressResult) => {
                  setForm(prev => ({
                    ...prev,
                    pickupAddress: result.address,
                    pickupLat: result.lat ?? null,
                    pickupLng: result.lng ?? null,
                    // Auto-fill postal code if available from address components
                    pickupPostalCode: result.components?.postalCode || prev.pickupPostalCode,
                  }))
                }}
                placeholder="Enter pickup address"
                required
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="pickupPostalCode" className="text-xs sm:text-sm">Postal Code</Label>
                <Input
                  id="pickupPostalCode"
                  value={form.pickupPostalCode}
                  onChange={e => setForm({ ...form, pickupPostalCode: e.target.value.toUpperCase() })}
                  placeholder="T2Y 3Z1"
                  autoComplete="postal-code"
                  maxLength={7}
                  className="uppercase tracking-wider h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pickupContact" className="text-xs sm:text-sm">Contact Phone</Label>
                <Input
                  id="pickupContact"
                  value={form.pickupContact}
                  onChange={e => setForm({ ...form, pickupContact: e.target.value })}
                  placeholder="Phone number"
                  className="h-9"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recipient + Delivery */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm sm:text-base flex items-center gap-2">
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                  <UserRound className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500" />
                </div>
                Recipient
              </CardTitle>
              <RecipientPicker businessId={businessId} onSelect={handleSelectContact} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6 pt-0">
            {fromSavedContactId && (
              <div className="flex items-center justify-between gap-2 rounded-lg border border-green-500/30 bg-green-500/5 px-2 py-1.5">
                <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 min-w-0">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Using saved recipient</span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearRecipient}
                  className="h-6 px-2 text-xs"
                >
                  Clear
                </Button>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="recipientName" className="text-xs sm:text-sm">
                  Recipient Name
                </Label>
                <Input
                  id="recipientName"
                  value={form.recipientName}
                  onChange={e => setForm({ ...form, recipientName: e.target.value })}
                  placeholder="e.g. Jane Doe"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dropoffContact" className="text-xs sm:text-sm">
                  Phone
                </Label>
                <Input
                  id="dropoffContact"
                  type="tel"
                  value={form.dropoffContact}
                  onChange={e => setForm({ ...form, dropoffContact: e.target.value })}
                  placeholder="(555) 123-4567"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="dropoffAddress" className="text-xs sm:text-sm">Delivery Address *</Label>
              <AddressAutocomplete
                id="dropoffAddress"
                value={form.dropoffAddress}
                onChange={(value) => setForm(prev => ({ ...prev, dropoffAddress: value }))}
                onSelect={(result: AddressResult) => {
                  setForm(prev => ({
                    ...prev,
                    dropoffAddress: result.address,
                    dropoffLat: result.lat ?? null,
                    dropoffLng: result.lng ?? null,
                    // Auto-fill postal code if available from address components
                    dropoffPostalCode: result.components?.postalCode || prev.dropoffPostalCode,
                  }))
                }}
                placeholder="Enter delivery address"
                required
              />
            </div>

            {/* Distance Display */}
            {(distanceKm !== null || isCalculatingDistance) && (
              <div className="flex items-center gap-2 p-2 sm:p-3 rounded-lg bg-muted/50 border border-border">
                <Ruler className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground shrink-0" />
                {isCalculatingDistance ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Calculating...</span>
                  </>
                ) : (
                  <>
                    <span className="text-xs sm:text-sm font-medium">{distanceKm?.toFixed(1)} km</span>
                    <span className="text-xs sm:text-sm text-muted-foreground">from pickup</span>
                  </>
                )}
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="space-y-2">
                <Label htmlFor="dropoffPostalCode" className="text-xs sm:text-sm">Postal Code</Label>
                <Input
                  id="dropoffPostalCode"
                  value={form.dropoffPostalCode}
                  onChange={e => setForm({ ...form, dropoffPostalCode: e.target.value.toUpperCase() })}
                  placeholder="T2P 1J9"
                  autoComplete="postal-code"
                  maxLength={7}
                  className="uppercase tracking-wider h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="buzzCode" className="text-xs sm:text-sm">
                  Buzz / Unit Code
                </Label>
                <Input
                  id="buzzCode"
                  value={form.buzzCode}
                  onChange={e => setForm({ ...form, buzzCode: e.target.value })}
                  placeholder="e.g. #204, Buzz 1234"
                  autoComplete="off"
                  className="h-9"
                />
              </div>
            </div>

            {form.recipientName.trim() && !fromSavedContactId && (
              <label
                htmlFor="saveContact"
                className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  id="saveContact"
                  checked={form.saveContact}
                  onCheckedChange={c => setForm({ ...form, saveContact: c === true })}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-1.5">
                    <BookmarkPlus className="w-4 h-4 text-primary" />
                    Save recipient to address book
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Quickly pick this recipient next time without retyping their info.
                  </p>
                </div>
              </label>
            )}
          </CardContent>
        </Card>

        {/* Package Details */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Package className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-orange-500" />
              </div>
              Package Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6 pt-0">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="smallPackages" className="text-xs sm:text-sm">Small Packages</Label>
                <Input
                  id="smallPackages"
                  type="number"
                  min="0"
                  value={form.smallPackages}
                  onChange={e =>
                    setForm({ ...form, smallPackages: parseInt(e.target.value) || 0 })
                  }
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bigPackages" className="text-xs sm:text-sm">Big Packages</Label>
                <Input
                  id="bigPackages"
                  type="number"
                  min="0"
                  value={form.bigPackages}
                  onChange={e =>
                    setForm({ ...form, bigPackages: parseInt(e.target.value) || 0 })
                  }
                  className="h-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="packageDescription" className="text-xs sm:text-sm">Description</Label>
              <Input
                id="packageDescription"
                value={form.packageDescription}
                onChange={e => setForm({ ...form, packageDescription: e.target.value })}
                placeholder="e.g., Documents, Groceries"
                className="h-9"
              />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isRush"
                  checked={form.isRush}
                  onCheckedChange={c => setForm({ ...form, isRush: c === true })}
                />
                <Label htmlFor="isRush" className="text-xs sm:text-sm font-normal cursor-pointer">
                  Rush (45 min)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="isOutOfTown"
                  checked={form.isOutOfTown}
                  onCheckedChange={c => setForm({ ...form, isOutOfTown: c === true })}
                />
                <Label htmlFor="isOutOfTown" className="text-xs sm:text-sm font-normal cursor-pointer">
                  Out of town
                </Label>
              </div>
            </div>

            {/* Live cost preview */}
            {hasPackages && (
              <div className="space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label className="text-sm text-foreground">Estimated cost</Label>
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Confirmed at pickup
                  </span>
                </div>
                {rateCard ? (
                  <BillingBreakdownCard
                    rule={previewBreakdown.rule}
                    bigPackageCount={previewBreakdown.bigPackageCount}
                    outOfTown={form.isOutOfTown}
                    rush={form.isRush}
                    rate={previewBreakdown.rate}
                    gst={previewBreakdown.gst}
                    total={previewBreakdown.total}
                    gstApplicable={previewBreakdown.gstApplicable}
                    hasRateCard={true}
                  />
                ) : (
                  <p className="text-xs text-yellow-500 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2">
                    No rate card is set for this location — your admin must add one before this delivery can be billed.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Options */}
        <Card>
          <CardHeader className="pb-3 px-3 sm:px-6">
            <CardTitle className="text-sm sm:text-base flex items-center gap-2">
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" />
              </div>
              Delivery Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 px-3 sm:px-6 pt-0">
            <div className="space-y-1.5">
              <Label htmlFor="specialInstructions" className="text-xs sm:text-sm">Special Instructions</Label>
              <Textarea
                id="specialInstructions"
                value={form.specialInstructions}
                onChange={e => setForm({ ...form, specialInstructions: e.target.value })}
                placeholder="Gate codes, instructions..."
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="requireSignature"
                  checked={form.requireSignature}
                  onCheckedChange={c =>
                    setForm({ ...form, requireSignature: c === true })
                  }
                />
                <Label
                  htmlFor="requireSignature"
                  className="text-xs sm:text-sm font-normal cursor-pointer"
                >
                  Require signature
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="requirePhoto"
                  checked={form.requirePhoto}
                  onCheckedChange={c => setForm({ ...form, requirePhoto: c === true })}
                />
                <Label
                  htmlFor="requirePhoto"
                  className="text-xs sm:text-sm font-normal cursor-pointer"
                >
                  Require photo proof
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full h-11 text-sm sm:text-base" disabled={isSubmitting}>
          {isSubmitting ? (
            <>Creating Order...</>
          ) : (
            <>
              <Truck className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Post Delivery
            </>
          )}
        </Button>
      </form>

      {/* Duplicate Address Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Duplicate Address Found
            </DialogTitle>
            <DialogDescription>
              You already have a delivery going to this address today
            </DialogDescription>
          </DialogHeader>

          {duplicateDelivery && (
            <div className="space-y-4">
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-2">Existing Delivery</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{duplicateDelivery.businessName}</p>
                    <p>{duplicateDelivery.dropoffAddress}</p>
                    <p>
                      Status:{' '}
                      <span className="capitalize">
                        {duplicateDelivery.status.replace('_', ' ')}
                      </span>
                    </p>
                    {duplicateDelivery.driverName && (
                      <p>Driver: {duplicateDelivery.driverName}</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Button
                  onClick={handleCombineWithExisting}
                  className="w-full h-12 justify-start px-4"
                  variant="outline"
                >
                  <Copy className="w-5 h-5 mr-3 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">Combine with existing delivery</p>
                    <p className="text-xs text-muted-foreground">
                      Adds items, one billing
                    </p>
                  </div>
                </Button>

                <Button
                  onClick={handleKeepSeparate}
                  className="w-full h-12 justify-start px-4"
                  variant="outline"
                >
                  <FilePlus className="w-5 h-5 mr-3 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium">Keep as separate delivery</p>
                    <p className="text-xs text-muted-foreground">Separate billing</p>
                  </div>
                </Button>

                <Button
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setDuplicateDelivery(null)
                    setPendingManifest([])
                  }}
                  className="w-full h-12"
                  variant="ghost"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
