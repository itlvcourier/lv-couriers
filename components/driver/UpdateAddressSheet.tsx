'use client'

import { useState, useCallback } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { AddressAutocomplete, type AddressResult } from '@/components/shared/AddressAutocomplete'
import { CameraCapture } from '@/components/shared/CameraCapture'
import { useFeatureSettings } from '@/lib/hooks/useFeatureFlag'
import {
  validateAddressRemote,
  applyAddressChange,
  confidenceMeta,
  type AddressChangeSource,
} from '@/lib/address-intelligence'
import { createDispatchRequest } from '@/lib/dispatch-requests'
import type { GeocodeConfidence } from '@/lib/google-maps'
import { toast } from 'sonner'
import { MapPin, Loader2, ShieldCheck, AlertTriangle, Camera, Check } from 'lucide-react'

interface UpdateAddressSheetProps {
  deliveryId: string
  currentAddress: string
  driverId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called after a successful direct apply (not for approval submissions). */
  onApplied?: () => void
}

const SOURCE_OPTIONS: { value: AddressChangeSource; label: string }[] = [
  { value: 'recipient_sms', label: 'Recipient texted new address' },
  { value: 'business_sms', label: 'Business texted correction' },
  { value: 'phoned', label: 'Confirmed by phone' },
  { value: 'pin_drop', label: 'Dropped a pin on the door' },
  { value: 'autocomplete', label: 'Found via address search' },
]

type ValidationState = {
  confidence: GeocodeConfidence
  lat: number | null
  lng: number | null
  postal: string | null
  issues: string[]
} | null

export function UpdateAddressSheet({
  deliveryId,
  currentAddress,
  driverId,
  open,
  onOpenChange,
  onApplied,
}: UpdateAddressSheetProps) {
  const settings = useFeatureSettings()
  const requiresApproval = settings?.driver_address_change_requires_approval ?? true
  const validationLevel = settings?.address_validation_level ?? 'soft'

  const [address, setAddress] = useState('')
  const [source, setSource] = useState<AddressChangeSource>('recipient_sms')
  const [note, setNote] = useState('')
  const [validation, setValidation] = useState<ValidationState>(null)
  const [validating, setValidating] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [evidencePhoto, setEvidencePhoto] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)

  const reset = useCallback(() => {
    setAddress('')
    setSource('recipient_sms')
    setNote('')
    setValidation(null)
    setEvidencePhoto(null)
  }, [])

  const handleSelect = useCallback((result: AddressResult) => {
    // Seed coordinates from the autocomplete pick; we still validate for confidence.
    setValidation((prev) => ({
      confidence: prev?.confidence ?? 'inferred',
      lat: result.lat ?? null,
      lng: result.lng ?? null,
      postal: result.components?.postalCode ?? null,
      issues: prev?.issues ?? [],
    }))
  }, [])

  const handleValidate = useCallback(async () => {
    if (address.trim().length < 3) {
      toast.error('Enter an address to validate')
      return
    }
    setValidating(true)
    const result = await validateAddressRemote(address)
    setValidating(false)
    if (!result) {
      setValidation({ confidence: 'manual', lat: null, lng: null, postal: null, issues: ['Validation unavailable.'] })
      toast.warning('Could not validate — you can still submit a manual pin')
      return
    }
    setValidation({
      confidence: result.confidence,
      lat: result.lat,
      lng: result.lng,
      postal: result.postalCode,
      issues: result.issues,
    })
    if (result.confidence === 'complete') toast.success('Address verified')
    else if (result.confidence === 'unconfirmed') toast.warning('Address could not be fully confirmed')
  }, [address])

  const handlePhoto = useCallback((dataUrl: string) => {
    setEvidencePhoto(dataUrl)
    setShowCamera(false)
    toast.success('Evidence photo attached')
  }, [])

  // Hard validation blocks submitting an unconfirmed address.
  const blockedByHardValidation =
    validationLevel === 'hard' && (!validation || validation.confidence === 'unconfirmed')

  const handleSubmit = useCallback(async () => {
    if (address.trim().length < 3) {
      toast.error('Enter the corrected address')
      return
    }
    if (blockedByHardValidation) {
      toast.error('Address must be validated before it can be saved')
      return
    }
    setSubmitting(true)
    try {
      const confidence: GeocodeConfidence = validation?.confidence ?? 'manual'
      const payload = {
        new_address: address,
        new_lat: validation?.lat ?? null,
        new_lng: validation?.lng ?? null,
        new_postal: validation?.postal ?? null,
        geocode_confidence: confidence,
        source,
        note,
        evidence_photo_url: evidencePhoto,
      }

      if (requiresApproval) {
        await createDispatchRequest({
          type: 'address_change',
          deliveryId,
          requestedBy: driverId ?? null,
          requestedByRole: 'driver',
          reason: note || `Address change (${source})`,
          payload,
          expiresInMinutes: 120,
        })
        toast.success('Address change sent for approval')
      } else {
        await applyAddressChange({
          deliveryId,
          newAddress: address,
          newPostal: validation?.postal ?? null,
          newLat: validation?.lat ?? null,
          newLng: validation?.lng ?? null,
          geocodeConfidence: confidence,
          source,
          evidencePhotoUrl: evidencePhoto,
          changedBy: driverId ?? null,
          actorType: 'driver',
        })
        toast.success('Address updated')
        onApplied?.()
      }
      reset()
      onOpenChange(false)
    } catch (err) {
      console.log('[v0] update address submit failed:', err)
      toast.error('Could not save address change')
    } finally {
      setSubmitting(false)
    }
  }, [address, blockedByHardValidation, validation, source, note, evidencePhoto, requiresApproval, deliveryId, driverId, onApplied, onOpenChange, reset])

  const meta = confidenceMeta(validation?.confidence)

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Update drop-off address</SheetTitle>
            <SheetDescription>
              {requiresApproval
                ? 'Your change will be sent to dispatch for approval.'
                : 'The new address takes effect immediately.'}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-5 px-4 pb-8 pt-2">
            <div className="rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">Current address</p>
              <p className="text-sm text-foreground flex items-start gap-1.5 mt-0.5">
                <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{currentAddress}</span>
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="new-address">Corrected address</Label>
              <AddressAutocomplete
                id="new-address"
                value={address}
                onChange={(v) => {
                  setAddress(v)
                  setValidation(null)
                }}
                onSelect={handleSelect}
                placeholder="Search the corrected address..."
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleValidate}
                disabled={validating || address.trim().length < 3}
                className="gap-1.5"
              >
                {validating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                Validate address
              </Button>
            </div>

            {validation && (
              <div className="rounded-lg border border-border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Validation result</span>
                  <Badge variant="outline" className={meta.className}>
                    {validation.confidence === 'complete' ? (
                      <Check className="w-3 h-3 mr-1" />
                    ) : (
                      <AlertTriangle className="w-3 h-3 mr-1" />
                    )}
                    {meta.label}
                  </Badge>
                </div>
                {validation.lat != null && (
                  <p className="text-xs text-muted-foreground">
                    Pin: {validation.lat.toFixed(5)}, {validation.lng?.toFixed(5)}
                  </p>
                )}
                {validation.issues.length > 0 && (
                  <ul className="text-xs text-muted-foreground list-disc list-inside space-y-0.5">
                    {validation.issues.map((issue, i) => (
                      <li key={i}>{issue}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="source">How was this confirmed?</Label>
              <Select value={source} onValueChange={(v) => setSource(v as AddressChangeSource)}>
                <SelectTrigger id="source">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Recipient said unit 304, buzz #12"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Evidence photo (optional)</Label>
              {evidencePhoto ? (
                <div className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={evidencePhoto || '/placeholder.svg'}
                    alt="Address evidence"
                    className="w-16 h-16 rounded-lg object-cover border border-border"
                  />
                  <Button variant="outline" size="sm" onClick={() => setEvidencePhoto(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={() => setShowCamera(true)} className="gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  Add photo
                </Button>
              )}
            </div>

            {blockedByHardValidation && (
              <p className="text-xs text-red-500 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                Hard validation is on — validate to a confirmed address before saving.
              </p>
            )}

            <Button
              onClick={handleSubmit}
              disabled={submitting || blockedByHardValidation || address.trim().length < 3}
              className="w-full h-12 rounded-xl"
            >
              {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {requiresApproval ? 'Send for approval' : 'Save new address'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {showCamera && (
        <CameraCapture
          onCapture={handlePhoto}
          onCancel={() => setShowCamera(false)}
          label="Capture address evidence"
        />
      )}
    </>
  )
}
