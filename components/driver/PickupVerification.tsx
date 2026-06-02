'use client'

import { useMemo, useState } from 'react'
import { useApp } from '@/lib/context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { X, Package, AlertCircle, CheckCircle, Navigation, Zap, Camera, Ruler } from 'lucide-react'
import type { Delivery, PickupVerification as VerificationType, ManifestItem } from '@/lib/types'
import { calculateBreakdown, findMatchingTier } from '@/lib/billing'
import { RuleBadge } from '@/components/shared/CostCalculator'
import { CameraCapture } from '@/components/shared/CameraCapture'

interface PickupVerificationProps {
  delivery: Delivery
  onClose: () => void
}

export function PickupVerification({ delivery, onClose }: PickupVerificationProps) {
  const { verifyPickup, advanceStatus, getRateCardForLocation } = useApp()
  const rateCard = getRateCardForLocation(delivery.locationId)
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [pickupPhoto, setPickupPhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [verifications, setVerifications] = useState<Record<string, { qty: number; photo: string | null; outOfTown: boolean }>>(
    () => {
      const initial: Record<string, { qty: number; photo: string | null; outOfTown: boolean }> = {}
      delivery.manifest.forEach(item => {
        initial[item.id] = { qty: item.postedQty, photo: null, outOfTown: false }
      })
      return initial
    }
  )
  const [hasDiscrepancy, setHasDiscrepancy] = useState(false)

  // Check if this rate card uses distance-based pricing
  const isDistanceBased = rateCard?.useRadiusPricing && (rateCard.radiusTiers?.length ?? 0) > 0
  const distanceKm = delivery.distanceKm ?? null

  // Build a pseudo-manifest for "confirmed" using the driver's current inputs.
  const confirmedManifest: ManifestItem[] = useMemo(
    () =>
      delivery.manifest.map(item => ({
        ...item,
        confirmedQty: verifications[item.id]?.qty ?? item.postedQty,
      })),
    [delivery.manifest, verifications],
  )

  // OOT for billing = delivery-level flag OR any per-item OOT toggle set at pickup.
  // Note: For distance-based pricing, OOT toggle is ignored - distance determines the rate
  const effectiveOot = isDistanceBased 
    ? false 
    : (delivery.isOutOfTown || Object.values(verifications).some(v => v?.outOfTown === true))

  const postedBreakdown = useMemo(
    () => calculateBreakdown(delivery.manifest, delivery.isOutOfTown, delivery.isUrgent, rateCard, false, isDistanceBased ? distanceKm : null),
    [delivery.manifest, delivery.isOutOfTown, delivery.isUrgent, rateCard, isDistanceBased, distanceKm],
  )

  const confirmedBreakdown = useMemo(
    () => calculateBreakdown(confirmedManifest, effectiveOot, delivery.isUrgent, rateCard, true, isDistanceBased ? distanceKm : null),
    [confirmedManifest, effectiveOot, delivery.isUrgent, rateCard, isDistanceBased, distanceKm],
  )

  // Get matched tier for display
  const matchedTier = useMemo(() => {
    if (!isDistanceBased || !rateCard?.radiusTiers || distanceKm === null) return null
    return findMatchingTier(distanceKm, rateCard.radiusTiers)
  }, [isDistanceBased, distanceKm, rateCard?.radiusTiers])

  const ruleChanged = postedBreakdown.rule !== confirmedBreakdown.rule
  const rateChanged = postedBreakdown.rate !== confirmedBreakdown.rate

  // Upload photo to blob storage
  const uploadProofPhoto = async (imageData: string, photoType: string): Promise<string | null> => {
    try {
      const formData = new FormData()
      formData.append('image', imageData)
      formData.append('deliveryId', delivery.id)
      formData.append('photoType', photoType)

      const response = await fetch('/api/delivery/upload-proof', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Upload failed')
      }

      const data = await response.json()
      return data.pathname
    } catch (error) {
      console.error('Photo upload error:', error)
      return null
    }
  }

  const handleQtyChange = (itemId: string, value: string) => {
    const qty = parseInt(value) || 0
    setVerifications(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], qty }
    }))
    
    // Check for discrepancies
    const item = delivery.manifest.find(m => m.id === itemId)
    if (item && qty !== item.postedQty) {
      setHasDiscrepancy(true)
    }
  }

  const handlePickupPhotoCapture = async (imageDataUrl: string) => {
    // Upload to blob storage
    await uploadProofPhoto(imageDataUrl, 'pickup')
    setPickupPhoto(imageDataUrl)
    setShowCamera(false)
    toast.success('Pickup photo captured')
  }

  const handleOutOfTownToggle = (itemId: string, checked: boolean) => {
    setVerifications(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], outOfTown: checked }
    }))
  }

  const handleConfirm = async () => {
    if (!pickupPhoto) {
      toast.error('Please take a pickup photo first')
      return
    }

    const pickupVerifications: VerificationType[] = delivery.manifest.map(item => ({
      itemId: item.id,
      confirmedQty: verifications[item.id]?.qty ?? item.postedQty,
      photoUrl: verifications[item.id]?.photo ?? null,
      outOfTown: verifications[item.id]?.outOfTown ?? false,
    }))

    verifyPickup(delivery.id, pickupVerifications)
    setShowConfirmation(true)
  }

  // Start the delivery run and open turn-by-turn directions in one tap.
  // Advancing to "en route to drop-off" is what notifies the recipient with
  // their tracking link, so the driver never has to come back and tap a
  // separate "Start Delivery Run" button.
  const handleStartDeliveryAndNavigate = () => {
    advanceStatus(delivery.id)
    const encoded = encodeURIComponent(delivery.dropoffAddress)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank')
    toast.success('Delivery started - navigating to drop-off')
    onClose()
  }

  const allItemsVerified = delivery.manifest.every(item => {
    const v = verifications[item.id]
    // Only the single pickup photo is required now; per-item photos were
    // removed so the driver isn't asked for two separate photos.
    return v?.qty !== undefined && v.qty >= 0
  })

  // Show confirmation screen after pickup verified
  if (showConfirmation) {
    return (
      <Sheet open onOpenChange={onClose}>
        <SheetContent side="bottom" className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl">
          <div className="py-8 text-center">
            {/* Success icon */}
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-[var(--accent-green)]/10 flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-[var(--accent-green)]" />
            </div>
            
            <h2 className="text-xl font-semibold text-foreground mb-2">Pickup Confirmed!</h2>
            <p className="text-muted-foreground mb-6">
              Start the delivery run to notify the recipient and get directions.
            </p>

            {/* Single button: starts the run AND opens directions together */}
            <Button
              onClick={handleStartDeliveryAndNavigate}
              className="w-full h-12 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Start Delivery & Navigate
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground">Verify Pickup</SheetTitle>
            <button onClick={onClose} className="tap-target">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Confirm the items you&apos;re picking up from {delivery.businessName}
          </p>
        </SheetHeader>

        <div className="space-y-4">
          {/* REQUIRED Pickup Photo */}
          <div className="p-4 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-color)]">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-muted-foreground" />
                <span className="font-medium text-foreground">Pickup Photo</span>
                <span className="text-xs text-red-500 font-medium">Required</span>
              </div>
            </div>
            
            {pickupPhoto ? (
              <div className="relative rounded-lg overflow-hidden bg-black flex items-center justify-center">
                <img 
                  src={pickupPhoto} 
                  alt="Pickup verification"
                  className="w-full h-40 object-contain"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1 px-2 py-1 rounded bg-[var(--accent-green)]/90 text-white text-xs">
                  <CheckCircle className="w-3 h-3" />
                  Captured
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPickupPhoto(null)}
                  className="absolute bottom-2 right-2"
                >
                  Retake
                </Button>
              </div>
            ) : showCamera ? (
              <CameraCapture
                onCapture={handlePickupPhotoCapture}
                onCancel={() => setShowCamera(false)}
                label="Take Pickup Photo"
                required
              />
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowCamera(true)}
                className="w-full h-24 rounded-xl border-dashed border-[var(--border-color)] tap-target"
              >
                <Camera className="w-6 h-6 mr-2" />
                Take Pickup Photo
              </Button>
            )}
            
            {!pickupPhoto && (
              <p className="text-xs text-amber-500 mt-2 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                Photo required before confirming pickup
              </p>
            )}
          </div>

          {/* Manifest Items */}
          {delivery.manifest.map((item) => (
            <div 
              key={item.id}
              className="p-4 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-color)]"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <span className="font-medium text-foreground">
                    {item.type === 'small_package' ? 'Small Package' : 
                     item.type === 'big_package' ? 'Big Package' :
                     item.type === 'out_of_town' ? 'Out of Town' : 'Rush'}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground">
                  Expected: {item.postedQty}
                </span>
              </div>

              {/* Notes */}
              {item.notes && (
                <p className="text-sm text-muted-foreground italic mb-3">
                  &quot;{item.notes}&quot;
                </p>
              )}

              {/* Quantity input */}
              <div className="flex items-center gap-3 mb-3">
                <label className="text-sm text-muted-foreground">Actual qty:</label>
                <Input
                  type="number"
                  min="0"
                  value={verifications[item.id]?.qty ?? item.postedQty}
                  onChange={(e) => handleQtyChange(item.id, e.target.value)}
                  className="w-20 h-10 text-center bg-[var(--bg-card)] border-[var(--border-color)]"
                />
                {verifications[item.id]?.qty !== item.postedQty && (
                  <span className="flex items-center gap-1 text-xs text-[var(--accent-yellow)]">
                    <AlertCircle className="w-3 h-3" />
                    Discrepancy
                  </span>
                )}
              </div>

              {/* Out of town toggle - hidden for distance-based pricing */}
              {!isDistanceBased && (
                <div className="flex items-center gap-2">
                  <Checkbox
                    id={`oot-${item.id}`}
                    checked={verifications[item.id]?.outOfTown || false}
                    onCheckedChange={(checked) => handleOutOfTownToggle(item.id, checked as boolean)}
                  />
                  <label 
                    htmlFor={`oot-${item.id}`} 
                    className="text-sm text-muted-foreground cursor-pointer"
                  >
                    Out of town delivery
                  </label>
                </div>
              )}
            </div>
          ))}

          {/* Discrepancy warning */}
          {hasDiscrepancy && (
            <div className="p-4 rounded-xl bg-[var(--accent-yellow)]/10 border border-[var(--accent-yellow)]/20">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[var(--accent-yellow)] shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-[var(--accent-yellow)]">Quantity Discrepancy</p>
                  <p className="text-xs text-[var(--accent-yellow)]/80 mt-1">
                    The actual quantity differs from posted. Admin will be notified.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Live billing preview */}
          {rateCard && (
            <div
              className={
                ruleChanged || rateChanged
                  ? 'p-4 rounded-xl bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/30 space-y-3'
                  : 'p-4 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-color)] space-y-3'
              }
            >
              <div className="flex items-center gap-2">
                <Zap className={`w-4 h-4 ${ruleChanged || rateChanged ? 'text-[var(--accent-orange)]' : 'text-muted-foreground'}`} />
                <p className="text-sm font-medium text-foreground">
                  {ruleChanged
                    ? 'Rate updated'
                    : rateChanged
                      ? 'Rate adjusted'
                      : 'Rate unchanged'}
                </p>
                <span className="ml-auto">
                  <RuleBadge rule={confirmedBreakdown.rule} />
                </span>
              </div>

              {/* Distance info for distance-based pricing */}
              {isDistanceBased && distanceKm !== null && matchedTier && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Ruler className="w-4 h-4" />
                  <span>{distanceKm.toFixed(1)} km</span>
                  <span className="text-foreground">&middot;</span>
                  <span className="text-foreground">{matchedTier.label || `Up to ${matchedTier.maxDistanceKm}km`}</span>
                </div>
              )}

              {(ruleChanged || rateChanged) ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span>Posted · {postedBreakdown.rule}</span>
                    <span className="tabular-nums">${postedBreakdown.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-foreground font-medium">
                    <span>Confirmed · {confirmedBreakdown.rule}</span>
                    <span className="tabular-nums">${confirmedBreakdown.rate.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
                    <span className="text-foreground">New charge</span>
                    <span className="tabular-nums text-foreground font-semibold">
                      ${confirmedBreakdown.total.toFixed(2)}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Charge</span>
                  <span className="tabular-nums text-foreground font-semibold">
                    ${confirmedBreakdown.total.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            disabled={!allItemsVerified || !pickupPhoto}
            className="w-full h-12 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium disabled:opacity-50"
          >
            Confirm Pickup
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
