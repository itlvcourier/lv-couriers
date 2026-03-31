'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel, FieldDescription } from '@/components/ui/field'
import { CheckCircle2, Package, FileText, AlertTriangle, Truck, Box, Loader2 } from 'lucide-react'
import type { PackageType, NewDeliveryData } from '@/lib/types'
import { toast } from 'sonner'

const packageTypes: { value: PackageType; label: string; icon: typeof Package }[] = [
  { value: 'Document', label: 'Document', icon: FileText },
  { value: 'Parcel', label: 'Parcel', icon: Package },
  { value: 'Fragile', label: 'Fragile', icon: AlertTriangle },
  { value: 'Large Item', label: 'Large Item', icon: Truck },
  { value: 'Other', label: 'Other', icon: Box },
]

const savedAddresses = [
  '1423 Kensington Rd NW, Calgary, AB T2N 3P9',
  '2525 36 St NE, Calgary, AB T1Y 5T4',
]

interface PostDeliveryProps {
  onSwitchToDeliveries: () => void
}

export function PostDelivery({ onSwitchToDeliveries }: PostDeliveryProps) {
  const { postDelivery, businesses, activeBusinessId } = useApp()
  const business = businesses.find(b => b.id === activeBusinessId)

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [packageType, setPackageType] = useState<PackageType | ''>('')
  const [notes, setNotes] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pickupAddress || !dropoffAddress || !packageType) return

    setIsSubmitting(true)

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const data: NewDeliveryData = {
      businessId: activeBusinessId,
      businessName: business?.name || 'Unknown Business',
      pickupAddress,
      pickupArea: extractArea(pickupAddress),
      dropoffAddress,
      dropoffArea: extractArea(dropoffAddress),
      packageType,
      notes,
      isUrgent,
    }

    postDelivery(data)
    setIsSubmitting(false)
    setIsSuccess(true)
    // TODO: Add push notification trigger here
    toast.success('Delivery posted successfully!')
  }

  const extractArea = (address: string): string => {
    // Simple extraction - in real app this would use geocoding
    if (address.toLowerCase().includes('nw')) return 'NW Calgary'
    if (address.toLowerCase().includes('ne')) return 'NE Calgary'
    if (address.toLowerCase().includes('sw')) return 'SW Calgary'
    if (address.toLowerCase().includes('se')) return 'SE Calgary'
    if (address.toLowerCase().includes('downtown')) return 'Downtown'
    return 'Calgary'
  }

  const resetForm = () => {
    setPickupAddress('')
    setDropoffAddress('')
    setPackageType('')
    setNotes('')
    setIsUrgent(false)
    setIsSuccess(false)
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#e8eaf0] mb-2">Delivery Posted!</h2>
        <p className="text-sm text-[#6b7280] text-center mb-6">
          Your delivery has been added to the driver queue
        </p>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <Button
            onClick={resetForm}
            className="h-12 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            Post Another
          </Button>
          <Button
            onClick={onSwitchToDeliveries}
            variant="outline"
            className="h-12 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
          >
            View My Deliveries
          </Button>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 pb-24 animate-fade-in">
      <div className="bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
        <h2 className="text-lg font-semibold text-[#e8eaf0] mb-4">New Delivery</h2>
        
        <FieldGroup>
          {/* Pickup Address */}
          <Field>
            <FieldLabel className="text-[#e8eaf0]">Pickup Address</FieldLabel>
            <Input
              value={pickupAddress}
              onChange={(e) => setPickupAddress(e.target.value)}
              placeholder="Enter pickup address"
              className="h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl focus:border-orange-500 placeholder:text-[#6b7280]"
              required
            />
            <div className="flex flex-wrap gap-2 mt-2">
              {savedAddresses.map(addr => (
                <button
                  key={addr}
                  type="button"
                  onClick={() => setPickupAddress(addr)}
                  className="text-xs px-3 py-1.5 rounded-full bg-[#1a1e2a] text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1f2535] transition-colors"
                >
                  {addr.split(',')[0]}
                </button>
              ))}
            </div>
          </Field>

          {/* Dropoff Address */}
          <Field>
            <FieldLabel className="text-[#e8eaf0]">Drop-off Address</FieldLabel>
            <Input
              value={dropoffAddress}
              onChange={(e) => setDropoffAddress(e.target.value)}
              placeholder="Enter drop-off address"
              className="h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl focus:border-orange-500 placeholder:text-[#6b7280]"
              required
            />
          </Field>

          {/* Package Type */}
          <Field>
            <FieldLabel className="text-[#e8eaf0]">Package Type</FieldLabel>
            <Select value={packageType} onValueChange={(v) => setPackageType(v as PackageType)}>
              <SelectTrigger className="h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl">
                <SelectValue placeholder="Select package type" />
              </SelectTrigger>
              <SelectContent className="bg-[#141720] border-[#1f2535]">
                {packageTypes.map(type => (
                  <SelectItem
                    key={type.value}
                    value={type.value}
                    className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                  >
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4 text-[#6b7280]" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {/* Notes */}
          <Field>
            <FieldLabel className="text-[#e8eaf0]">Package Details / Notes</FieldLabel>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 300))}
              placeholder="Special instructions, fragile items, access codes, contact at drop-off..."
              className="min-h-[100px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl focus:border-orange-500 placeholder:text-[#6b7280] resize-none"
            />
            <div className="flex justify-end">
              <span className="text-xs text-[#6b7280]">{notes.length}/300</span>
            </div>
          </Field>

          {/* Urgency Toggle */}
          <Field>
            <div className="flex items-center justify-between p-4 bg-[#1a1e2a] rounded-xl">
              <div>
                <FieldLabel className="text-[#e8eaf0] mb-0">Mark as Urgent</FieldLabel>
                <FieldDescription className="text-[#6b7280] mt-0.5">
                  Urgent jobs appear highlighted for drivers
                </FieldDescription>
              </div>
              <Switch
                checked={isUrgent}
                onCheckedChange={setIsUrgent}
              />
            </div>
          </Field>
        </FieldGroup>

        {/* Submit button */}
        <Button
          type="submit"
          disabled={isSubmitting || !pickupAddress || !dropoffAddress || !packageType}
          className="w-full h-14 mt-6 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-base disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Posting...
            </>
          ) : (
            'Post Delivery'
          )}
        </Button>
      </div>
    </form>
  )
}
