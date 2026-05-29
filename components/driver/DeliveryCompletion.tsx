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
  const { completeDelivery } = useApp()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null)
  const [recipientNote, setRecipientNote] = useState('')
  const [isUploading, setIsUploading] = useState(false)

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
      setPhotoUrl(imageDataUrl) // Store locally for preview
      toast.success('Delivery photo captured and saved')
    }
    setIsUploading(false)
  }

  const handleComplete = async () => {
    if (!photoUrl) {
      toast.error('Please take a proof of delivery photo')
      return
    }
    if (requiresSignature && !signatureDataUrl) {
      toast.error('A recipient signature is required for this delivery')
      return
    }

    setIsUploading(true)

    try {
      // Upload signature if exists
      let signaturePath: string | null = null
      if (signatureDataUrl) {
        signaturePath = await uploadProofPhoto(signatureDataUrl, 'signature')
      }

      // Complete the delivery with the photo URLs
      completeDelivery(delivery.id, photoUrl, recipientNote || null, signatureDataUrl)
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
              ? 'Capture a proof photo and recipient signature to complete'
              : 'Take a proof of delivery photo to complete'}
          </p>
        </SheetHeader>

        <div className="space-y-6">
          {/* Photo capture - REQUIRED */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <label className="text-sm font-medium text-foreground">
                Proof of Delivery Photo
              </label>
              <span className="text-xs text-red-500 font-medium">Required</span>
            </div>
            
            {photoUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-black flex items-center justify-center">
                <img
                  src={photoUrl}
                  alt="Proof of delivery"
                  className="w-full h-48 object-contain"
                />
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-green)]/90 text-white text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Photo captured
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute bottom-3 right-3"
                >
                  Retake Photo
                </Button>
              </div>
            ) : (
              <CameraCapture
                onCapture={handlePhotoCapture}
                label="Take Proof Photo"
                required
              />
            )}
            
            {!photoUrl && (
              <div className="mt-2 flex items-center gap-2 text-xs text-amber-500">
                <AlertCircle className="w-3 h-3" />
                Photo is required to complete delivery
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
            disabled={!photoUrl || (requiresSignature && !signatureDataUrl) || isUploading}
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
