'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { X, CheckCircle, PenLine, AlertCircle } from 'lucide-react'
import type { Delivery } from '@/lib/types'
import { SignaturePad } from '@/components/shared/SignaturePad'
import { CameraCapture } from '@/components/shared/CameraCapture'

interface DeliveryCompletionProps {
  delivery: Delivery
  onClose: () => void
}

export function DeliveryCompletion({ delivery, onClose }: DeliveryCompletionProps) {
  const { completeDelivery, settings } = useApp()
  // Multiple proof photos. The admin-configured minimum (default 3) gates
  // completion; drivers may add more than the minimum.
  const [photoUrls, setPhotoUrls] = useState<string[]>([])
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [recipientNote, setRecipientNote] = useState('')
  const [isUploading, setIsUploading] = useState(false)

  const minPhotos = Math.max(1, settings.minDeliveryPhotos ?? 3)
  const photoCount = photoUrls.length
  const hasEnoughPhotos = photoCount >= minPhotos

  // The business set this flag at order creation; we only require a signature
  // when they explicitly asked for one.
  const requiresSignature = !!delivery.requireSignature

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
      toast.error('Failed to upload photo')
      return null
    }
  }

  const handlePhotoCapture = async (imageDataUrl: string) => {
    setIsUploading(true)
    const pathname = await uploadProofPhoto(imageDataUrl, 'delivery')
    if (pathname) {
      // Store the local data URL for preview; the array order is the capture order.
      setPhotoUrls((prev) => [...prev, imageDataUrl])
      toast.success('Photo captured and saved')
    }
    setIsUploading(false)
  }

  const removePhoto = (index: number) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleComplete = async () => {
    if (!hasEnoughPhotos) {
      toast.error(`Please take at least ${minPhotos} proof of delivery photos`)
      return
    }
    if (requiresSignature && !signatureDataUrl) {
      toast.error('A recipient signature is required for this delivery')
      return
    }

    setIsUploading(true)

    try {
      // Upload signature if exists
      if (signatureDataUrl) {
        await uploadProofPhoto(signatureDataUrl, 'signature')
      }

      // Complete the delivery with the full set of proof photos.
      completeDelivery(delivery.id, photoUrls, recipientNote || null, signatureDataUrl)
      toast.success('Delivery completed!')
      onClose()
    } catch (error) {
      toast.error('Failed to complete delivery')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent
        side="bottom"
        className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl max-h-[92vh] overflow-y-auto"
      >
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground">Complete Delivery</SheetTitle>
            <button onClick={onClose} className="tap-target" aria-label="Close">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            {requiresSignature
              ? `Capture at least ${minPhotos} proof photos and a recipient signature to complete`
              : `Take at least ${minPhotos} proof of delivery photos to complete`}
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* Photo capture - REQUIRED (minimum configurable by admin) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-foreground">
                  Proof of Delivery Photos
                </label>
                <span className="text-xs text-red-500 font-medium">Required</span>
              </div>
              <span
                className={`text-xs font-semibold tabular-nums ${
                  hasEnoughPhotos ? 'text-[var(--accent-green)]' : 'text-amber-500'
                }`}
              >
                {photoCount}/{minPhotos}
              </span>
            </div>

            {/* Captured photo thumbnails */}
            {photoCount > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                {photoUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative rounded-xl overflow-hidden bg-black aspect-square"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url || '/placeholder.svg'}
                      alt={`Proof of delivery ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 text-white text-[10px] font-medium">
                      {index + 1}
                    </span>
                    <button
                      onClick={() => removePhoto(index)}
                      className="absolute top-1 right-1 w-6 h-6 flex items-center justify-center rounded-full bg-black/60 text-white tap-target"
                      aria-label={`Remove photo ${index + 1}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Capture control: keep showing until at least the minimum, then
                allow adding extras. */}
            <CameraCapture
              onCapture={handlePhotoCapture}
              label={photoCount === 0 ? 'Take Proof Photo' : 'Add Another Photo'}
              required={photoCount === 0}
            />

            {!hasEnoughPhotos && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
                <AlertCircle className="w-3 h-3" />
                {`Take ${minPhotos - photoCount} more ${
                  minPhotos - photoCount === 1 ? 'photo' : 'photos'
                } to complete (minimum ${minPhotos})`}
              </div>
            )}
            {hasEnoughPhotos && (
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--accent-green)]">
                <CheckCircle className="w-3 h-3" />
                Minimum photos captured — you can add more if needed
              </div>
            )}
          </div>

          {/* Signature (only when business required it) */}
          {requiresSignature && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <PenLine className="w-4 h-4 text-muted-foreground" />
                <label className="text-sm font-medium text-foreground">
                  Recipient Signature
                </label>
                <span className="text-xs text-red-500 font-medium">Required</span>
              </div>

              <SignaturePad onChange={setSignatureDataUrl} />

              {signatureDataUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs text-[var(--accent-green)]">
                  <CheckCircle className="w-3 h-3" />
                  Signature captured
                </div>
              )}

              {!signatureDataUrl && (
                <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
                  <AlertCircle className="w-3 h-3" />
                  Signature is required for this delivery
                </div>
              )}
            </div>
          )}

          {/* Recipient note */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Recipient Note (optional)
            </label>
            <Textarea
              placeholder="e.g., Left at front door, handed to security, etc."
              value={recipientNote}
              onChange={(e) => setRecipientNote(e.target.value)}
              className="bg-[var(--bg-card-2)] border-[var(--border-color)] rounded-xl resize-none"
              rows={3}
            />
          </div>

          {/* Complete button */}
          <Button
            onClick={handleComplete}
            disabled={!hasEnoughPhotos || (requiresSignature && !signatureDataUrl) || isUploading}
            className="w-full h-12 rounded-xl tap-target bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90 text-white font-medium disabled:opacity-50"
          >
            {isUploading ? (
              'Processing...'
            ) : (
              <>
                <CheckCircle className="w-5 h-5 mr-2" />
                Complete Delivery
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
