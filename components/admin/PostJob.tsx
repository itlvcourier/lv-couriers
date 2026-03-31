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

export function PostJob() {
  const { postDelivery, businesses } = useApp()

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [selectedBusinessId, setSelectedBusinessId] = useState('')
  const [pickupAddress, setPickupAddress] = useState('')
  const [dropoffAddress, setDropoffAddress] = useState('')
  const [packageType, setPackageType] = useState<PackageType | ''>('')
  const [notes, setNotes] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)

  const selectedBusiness = businesses.find(b => b.id === selectedBusinessId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedBusinessId || !pickupAddress || !dropoffAddress || !packageType) return

    setIsSubmitting(true)
    await new Promise(resolve => setTimeout(resolve, 1000))

    const data: NewDeliveryData = {
      businessId: selectedBusinessId,
      businessName: selectedBusiness?.name || 'Unknown Business',
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
    toast.success('Delivery posted successfully!')
  }

  const extractArea = (address: string): string => {
    if (address.toLowerCase().includes('nw')) return 'NW Calgary'
    if (address.toLowerCase().includes('ne')) return 'NE Calgary'
    if (address.toLowerCase().includes('sw')) return 'SW Calgary'
    if (address.toLowerCase().includes('se')) return 'SE Calgary'
    if (address.toLowerCase().includes('downtown')) return 'Downtown'
    return 'Calgary'
  }

  const resetForm = () => {
    setSelectedBusinessId('')
    setPickupAddress('')
    setDropoffAddress('')
    setPackageType('')
    setNotes('')
    setIsUrgent(false)
    setIsSuccess(false)
  }

  if (isSuccess) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 animate-fade-in">
        <div className="w-20 h-20 rounded-full bg-green-500/20 flex items-center justify-center mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-[#e8eaf0] mb-2">Delivery Posted!</h2>
        <p className="text-sm text-[#6b7280] text-center mb-6">
          Posted on behalf of {selectedBusiness?.name}
        </p>
        <Button
          onClick={resetForm}
          className="h-12 px-8 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold"
        >
          Post Another
        </Button>
      </div>
    )
  }

  return (
    <div className="p-4 lg:p-6 animate-fade-in">
      <h1 className="text-xl font-bold text-[#e8eaf0] mb-6">Post Job</h1>

      <form onSubmit={handleSubmit} className="max-w-2xl">
        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl p-4 lg:p-6">
          <FieldGroup>
            {/* Business selector */}
            <Field>
              <FieldLabel className="text-[#e8eaf0]">Post on behalf of</FieldLabel>
              <Select value={selectedBusinessId} onValueChange={setSelectedBusinessId}>
                <SelectTrigger className="h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl">
                  <SelectValue placeholder="Select a business" />
                </SelectTrigger>
                <SelectContent className="bg-[#141720] border-[#1f2535]">
                  {businesses.map(b => (
                    <SelectItem
                      key={b.id}
                      value={b.id}
                      className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                    >
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

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
                placeholder="Special instructions, fragile items, access codes..."
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
                <Switch checked={isUrgent} onCheckedChange={setIsUrgent} />
              </div>
            </Field>
          </FieldGroup>

          <Button
            type="submit"
            disabled={isSubmitting || !selectedBusinessId || !pickupAddress || !dropoffAddress || !packageType}
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
    </div>
  )
}
