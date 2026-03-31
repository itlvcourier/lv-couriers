'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusStepper } from '@/components/shared/StatusStepper'
import { ProofPhotoUpload } from '@/components/shared/ProofPhotoUpload'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Truck, MapPin, Flag, ExternalLink, Package, Clock, AlertTriangle } from 'lucide-react'
import { formatRelativeTime } from '@/lib/delivery-utils'
import type { FailReason } from '@/lib/types'
import { toast } from 'sonner'

const failReasons: FailReason[] = [
  'No one home',
  'Wrong address',
  'Package refused',
  'Unable to access location',
  'Other',
]

export function ActiveDelivery() {
  const { deliveries, currentDriverId, advanceStatus, completeDelivery, failDelivery } = useApp()
  const [showProofSheet, setShowProofSheet] = useState(false)
  const [showFailSheet, setShowFailSheet] = useState(false)
  const [failReason, setFailReason] = useState<FailReason | ''>('')

  // Find active delivery for current driver
  const activeDelivery = deliveries.find(
    d => d.driverId === currentDriverId && 
    !['delivered', 'failed', 'posted'].includes(d.status)
  )

  if (!activeDelivery) {
    return (
      <div className="flex flex-col h-full items-center justify-center animate-fade-in">
        <EmptyState
          icon={Truck}
          title="No active delivery"
          subtitle="Go to Available to claim a job"
        />
      </div>
    )
  }

  const openMaps = (address: string) => {
    // TODO: Add GPS tracking here
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  const handleAdvance = () => {
    if (activeDelivery.status === 'en_route_dropoff') {
      setShowProofSheet(true)
    } else {
      advanceStatus(activeDelivery.id)
      toast.success('Status updated')
    }
  }

  const handleComplete = (photoUrl: string) => {
    completeDelivery(activeDelivery.id, photoUrl)
    setShowProofSheet(false)
    // TODO: Add push notification trigger here
    toast.success('Delivery completed!')
  }

  const handleFail = () => {
    if (failReason) {
      failDelivery(activeDelivery.id, failReason)
      setShowFailSheet(false)
      setFailReason('')
      toast.error('Delivery marked as failed')
    }
  }

  const getButtonConfig = () => {
    switch (activeDelivery.status) {
      case 'claimed':
        return { label: 'Start Pickup Run', color: 'bg-blue-500 hover:bg-blue-600' }
      case 'en_route_pickup':
        return { label: 'Confirm Pickup', color: 'bg-orange-500 hover:bg-orange-600' }
      case 'picked_up':
        return { label: 'Start Delivery Run', color: 'bg-blue-500 hover:bg-blue-600' }
      case 'en_route_dropoff':
        return { label: 'Mark as Delivered', color: 'bg-green-500 hover:bg-green-600' }
      default:
        return { label: 'Continue', color: 'bg-orange-500 hover:bg-orange-600' }
    }
  }

  const buttonConfig = getButtonConfig()

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 animate-fade-in">
      {/* Job overview card */}
      <div className="m-4 bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h2 className="text-lg font-semibold text-[#e8eaf0]">{activeDelivery.businessName}</h2>
            <div className="flex items-center gap-2 mt-1">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1a1e2a] text-[#6b7280]">
                <Package className="w-3 h-3" />
                {activeDelivery.packageType}
              </span>
              {activeDelivery.isUrgent && (
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 animate-urgent-pulse">
                  Urgent
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1 text-xs text-[#6b7280]">
            <Clock className="w-3 h-3" />
            {formatRelativeTime(activeDelivery.postedAt)}
          </div>
        </div>

        {activeDelivery.notes && (
          <p className="text-sm text-[#6b7280] italic mb-3 pb-3 border-b border-[#1f2535]">
            {activeDelivery.notes}
          </p>
        )}
      </div>

      {/* Address cards */}
      <div className="px-4 space-y-3">
        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <MapPin className="w-5 h-5 text-blue-400" />
            <span className="text-sm font-semibold text-[#6b7280]">Pickup Location</span>
          </div>
          <p className="text-sm text-[#e8eaf0] mb-3">{activeDelivery.pickupAddress}</p>
          <Button
            onClick={() => openMaps(activeDelivery.pickupAddress)}
            variant="outline"
            className="w-full h-11 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Maps
          </Button>
        </div>

        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Flag className="w-5 h-5 text-green-400" />
            <span className="text-sm font-semibold text-[#6b7280]">Drop-off Location</span>
          </div>
          <p className="text-sm text-[#e8eaf0] mb-3">{activeDelivery.dropoffAddress}</p>
          <Button
            onClick={() => openMaps(activeDelivery.dropoffAddress)}
            variant="outline"
            className="w-full h-11 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Open in Maps
          </Button>
        </div>
      </div>

      {/* Status stepper */}
      <div className="mx-4 mt-6 bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
        <h3 className="text-sm font-semibold text-[#6b7280] mb-4">Delivery Progress</h3>
        <StatusStepper currentStatus={activeDelivery.status} />
      </div>

      {/* Action button */}
      <div className="p-4 mt-4">
        <Button
          onClick={handleAdvance}
          className={`w-full h-14 rounded-xl text-white font-semibold text-base ${buttonConfig.color}`}
        >
          {buttonConfig.label}
        </Button>
      </div>

      {/* Proof of delivery sheet */}
      <Sheet open={showProofSheet} onOpenChange={setShowProofSheet}>
        <SheetContent side="bottom" className="bg-[#141720] border-t border-[#1f2535] rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-[#e8eaf0]">Proof of Delivery</SheetTitle>
            <p className="text-sm text-[#6b7280]">Take a photo of the delivered package</p>
          </SheetHeader>
          <ProofPhotoUpload
            onPhotoSelected={handleComplete}
            onCancel={() => setShowProofSheet(false)}
          />
          <button
            onClick={() => {
              setShowProofSheet(false)
              setShowFailSheet(true)
            }}
            className="w-full mt-4 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            Mark as Failed
          </button>
        </SheetContent>
      </Sheet>

      {/* Fail delivery sheet */}
      <Sheet open={showFailSheet} onOpenChange={setShowFailSheet}>
        <SheetContent side="bottom" className="bg-[#141720] border-t border-[#1f2535] rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-[#e8eaf0] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400" />
              Mark Delivery as Failed
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <Select value={failReason} onValueChange={(value) => setFailReason(value as FailReason)}>
              <SelectTrigger className="h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl">
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent className="bg-[#141720] border-[#1f2535]">
                {failReasons.map(reason => (
                  <SelectItem
                    key={reason}
                    value={reason}
                    className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                  >
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                onClick={() => setShowFailSheet(false)}
                variant="outline"
                className="flex-1 h-12 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
              >
                Cancel
              </Button>
              <Button
                onClick={handleFail}
                disabled={!failReason}
                className="flex-1 h-12 rounded-xl bg-red-500 hover:bg-red-600 text-white disabled:opacity-50"
              >
                Confirm Failed
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
