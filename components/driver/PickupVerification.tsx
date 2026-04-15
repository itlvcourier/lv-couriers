'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { toast } from 'sonner'
import { X, Package, Camera, AlertCircle, CheckCircle, Copy, Navigation } from 'lucide-react'
import type { Delivery, PickupVerification as VerificationType } from '@/lib/types'

interface PickupVerificationProps {
  delivery: Delivery
  onClose: () => void
}

export function PickupVerification({ delivery, onClose }: PickupVerificationProps) {
  const { verifyPickup, generateTrackingLink, sendTrackingSMS } = useApp()
  const [showConfirmation, setShowConfirmation] = useState(false)
  const [trackingCode, setTrackingCode] = useState<string | null>(null)
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

  const handlePhotoCapture = (itemId: string) => {
    // Simulate photo capture - in real app would use camera API
    const mockPhotoUrl = `https://picsum.photos/400/300?random=${Date.now()}`
    setVerifications(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], photo: mockPhotoUrl }
    }))
    toast.success('Photo captured')
  }

  const handleOutOfTownToggle = (itemId: string, checked: boolean) => {
    setVerifications(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], outOfTown: checked }
    }))
  }

  const handleConfirm = () => {
    const pickupVerifications: VerificationType[] = delivery.manifest.map(item => ({
      itemId: item.id,
      confirmedQty: verifications[item.id]?.qty ?? item.postedQty,
      photoUrl: verifications[item.id]?.photo ?? null,
      outOfTown: verifications[item.id]?.outOfTown ?? false,
    }))

    verifyPickup(delivery.id, pickupVerifications)
    
    // Generate tracking link and show confirmation
    const code = generateTrackingLink(delivery.id)
    setTrackingCode(code)
    
    // Send SMS if recipient phone exists
    if (delivery.recipientPhone) {
      sendTrackingSMS(delivery.id, delivery.recipientPhone)
    }
    
    setShowConfirmation(true)
  }
  
  const handleCopyLink = () => {
    if (trackingCode) {
      navigator.clipboard.writeText(`lvcourier.ca/track/${trackingCode}`)
      toast.success('Link copied to clipboard')
    }
  }
  
  const handleOpenMaps = () => {
    const encoded = encodeURIComponent(delivery.dropoffAddress)
    window.open(`https://www.google.com/maps/search/?api=1&query=${encoded}`, '_blank')
    onClose()
  }

  const allItemsVerified = delivery.manifest.every(item => {
    const v = verifications[item.id]
    // For big packages, photo is required
    if (item.type === 'big_package' && !v?.photo) return false
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
              {delivery.recipientPhone ? 'Tracking link sent to recipient' : 'Tracking link generated'}
            </p>
            
            {/* Tracking link */}
            {trackingCode && (
              <div className="mb-6 p-4 rounded-xl bg-[var(--bg-card-2)] border border-[var(--border-color)]">
                <p className="text-xs text-muted-foreground mb-2">Tracking Link</p>
                <p className="text-sm font-mono text-foreground mb-3">lvcourier.ca/track/{trackingCode}</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyLink}
                  className="gap-2 border-[var(--border-color)]"
                >
                  <Copy className="w-4 h-4" />
                  Copy Link
                </Button>
              </div>
            )}
            
            {/* Open Maps button */}
            <Button
              onClick={handleOpenMaps}
              className="w-full h-12 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium"
            >
              <Navigation className="w-4 h-4 mr-2" />
              Open Maps to Drop-off
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

              {/* Photo capture for big packages */}
              {item.type === 'big_package' && (
                <div className="mb-3">
                  {verifications[item.id]?.photo ? (
                    <div className="relative">
                      <img 
                        src={verifications[item.id].photo!} 
                        alt="Verification"
                        className="w-full h-32 object-cover rounded-lg"
                      />
                      <button
                        onClick={() => handlePhotoCapture(item.id)}
                        className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-black/50 text-white text-xs"
                      >
                        Retake
                      </button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      onClick={() => handlePhotoCapture(item.id)}
                      className="w-full h-11 rounded-xl border-dashed border-[var(--border-color)] tap-target"
                    >
                      <Camera className="w-4 h-4 mr-2" />
                      Take Photo (Required)
                    </Button>
                  )}
                </div>
              )}

              {/* Out of town toggle */}
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

          {/* Confirm button */}
          <Button
            onClick={handleConfirm}
            disabled={!allItemsVerified}
            className="w-full h-12 rounded-xl tap-target bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white font-medium disabled:opacity-50"
          >
            Confirm Pickup
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
