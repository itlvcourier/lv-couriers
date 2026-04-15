'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { toast } from 'sonner'
import { X, Camera, CheckCircle } from 'lucide-react'
import type { Delivery } from '@/lib/types'

interface DeliveryCompletionProps {
  delivery: Delivery
  onClose: () => void
}

export function DeliveryCompletion({ delivery, onClose }: DeliveryCompletionProps) {
  const { completeDelivery } = useApp()
  const [photoUrl, setPhotoUrl] = useState<string | null>(null)
  const [recipientNote, setRecipientNote] = useState('')

  const handlePhotoCapture = () => {
    // Simulate photo capture - in real app would use camera API
    const mockPhotoUrl = `https://picsum.photos/400/300?random=${Date.now()}`
    setPhotoUrl(mockPhotoUrl)
    toast.success('Photo captured')
  }

  const handleComplete = () => {
    if (!photoUrl) {
      toast.error('Please take a proof of delivery photo')
      return
    }

    completeDelivery(delivery.id, photoUrl, recipientNote || null)
    toast.success('Delivery completed!')
    onClose()
  }

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[var(--bg-card)] border-t border-[var(--border-color)] rounded-t-3xl">
        <SheetHeader className="mb-6">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-foreground">Complete Delivery</SheetTitle>
            <button onClick={onClose} className="tap-target">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Take a proof of delivery photo
          </p>
        </SheetHeader>

        <div className="space-y-4">
          {/* Photo capture */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">
              Proof of Delivery Photo *
            </label>
            {photoUrl ? (
              <div className="relative">
                <img 
                  src={photoUrl} 
                  alt="Proof of delivery"
                  className="w-full h-48 object-cover rounded-xl"
                />
                <button
                  onClick={handlePhotoCapture}
                  className="absolute bottom-3 right-3 px-4 py-2 rounded-lg bg-black/60 text-white text-sm font-medium tap-target"
                >
                  Retake Photo
                </button>
                <div className="absolute top-3 left-3 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--accent-green)]/90 text-white text-xs font-medium">
                  <CheckCircle className="w-3 h-3" />
                  Photo captured
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={handlePhotoCapture}
                className="w-full h-32 rounded-xl border-dashed border-[var(--border-color)] flex flex-col items-center justify-center gap-2 tap-target"
              >
                <Camera className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Take Proof Photo</span>
              </Button>
            )}
          </div>

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
            disabled={!photoUrl}
            className="w-full h-12 rounded-xl tap-target bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90 text-white font-medium disabled:opacity-50"
          >
            <CheckCircle className="w-5 h-5 mr-2" />
            Complete Delivery
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
