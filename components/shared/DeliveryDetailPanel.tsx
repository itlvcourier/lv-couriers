'use client'

import { X, MapPin, Flag, Phone, ExternalLink, Package, Copy, Link } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Delivery } from '@/lib/types'
import { StatusBadge } from './StatusBadge'
import { StatusTimeline } from './StatusTimeline'
import { formatRelativeTime, formatDateTime } from '@/lib/delivery-utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useApp } from '@/lib/context'
import { toast } from 'sonner'

interface DeliveryDetailPanelProps {
  delivery: Delivery | null
  open: boolean
  onClose: () => void
}

export function DeliveryDetailPanel({ delivery, open, onClose }: DeliveryDetailPanelProps) {
  const { drivers, reassignDriver } = useApp()
  const availableDrivers = drivers.filter(d => d.status === 'available')

  if (!delivery) return null

  const handleReassign = (newDriverId: string) => {
    reassignDriver(delivery.id, newDriverId)
    toast.success('Driver reassigned')
  }

  const openMaps = (address: string) => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  return (
    <Sheet open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <SheetContent className="w-full sm:max-w-md bg-[#141720] border-l border-[#1f2535] p-0 overflow-y-auto">
        <SheetHeader className="p-4 border-b border-[#1f2535]">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-[#e8eaf0]">Delivery Details</SheetTitle>
          </div>
        </SheetHeader>

        <div className="p-4 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-semibold text-[#e8eaf0]">{delivery.businessName}</h2>
              <p className="text-sm text-[#6b7280]">ID: {delivery.id}</p>
            </div>
            <StatusBadge status={delivery.status} />
          </div>

          {/* Package info */}
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-[#1a1e2a] text-[#e8eaf0]">
              <Package className="w-4 h-4 text-orange-500" />
              {delivery.packageType}
            </span>
            {delivery.isUrgent && (
              <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                Urgent
              </span>
            )}
          </div>

          {/* Addresses */}
          <div className="space-y-3">
            <div className="bg-[#1a1e2a] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <MapPin className="w-4 h-4 text-blue-400" />
                <span className="text-sm font-medium text-[#6b7280]">Pickup</span>
              </div>
              <p className="text-sm text-[#e8eaf0] mb-2">{delivery.pickupAddress}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMaps(delivery.pickupAddress)}
                className="h-8 text-xs border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open in Maps
              </Button>
            </div>

            <div className="bg-[#1a1e2a] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Flag className="w-4 h-4 text-green-400" />
                <span className="text-sm font-medium text-[#6b7280]">Drop-off</span>
              </div>
              <p className="text-sm text-[#e8eaf0] mb-2">{delivery.dropoffAddress}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openMaps(delivery.dropoffAddress)}
                className="h-8 text-xs border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                Open in Maps
              </Button>
            </div>
          </div>

          {/* Notes */}
          {delivery.notes && (
            <div>
              <h4 className="text-sm font-medium text-[#6b7280] mb-2">Notes</h4>
              <p className="text-sm text-[#e8eaf0] italic bg-[#1a1e2a] rounded-xl p-3">
                {delivery.notes}
              </p>
            </div>
          )}

          {/* Tracking Link - show after pickup */}
          {delivery.trackingCode && (
            <div>
              <h4 className="text-sm font-medium text-[#6b7280] mb-2">Tracking Link</h4>
              <div className="bg-[#1a1e2a] rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Link className="w-4 h-4 text-orange-400" />
                  <span className="text-sm font-mono text-[#e8eaf0]">
                    lvcourier.ca/track/{delivery.trackingCode}
                  </span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    navigator.clipboard.writeText(`lvcourier.ca/track/${delivery.trackingCode}`)
                    toast.success('Link copied to clipboard')
                  }}
                  className="h-8 text-xs border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy Link
                </Button>
              </div>
            </div>
          )}

          {/* Driver info */}
          <div>
            <h4 className="text-sm font-medium text-[#6b7280] mb-2">Driver</h4>
            {delivery.driverId ? (
              <div className="flex items-center gap-3 bg-[#1a1e2a] rounded-xl p-3">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-orange-500/20 text-orange-500">
                    {delivery.driverName?.split(' ').map(n => n[0]).join('') || '?'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="text-sm font-medium text-[#e8eaf0]">{delivery.driverName}</p>
                  <p className="text-xs text-[#6b7280]">
                    {drivers.find(d => d.id === delivery.driverId)?.phone}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-[#6b7280] italic">No driver assigned</p>
            )}

            {/* Reassign dropdown */}
            {delivery.status !== 'delivered' && delivery.status !== 'failed' && availableDrivers.length > 0 && (
              <div className="mt-3">
                <Select onValueChange={handleReassign}>
                  <SelectTrigger className="bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
                    <SelectValue placeholder="Reassign driver..." />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141720] border-[#1f2535]">
                    {availableDrivers.map(driver => (
                      <SelectItem
                        key={driver.id}
                        value={driver.id}
                        className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                      >
                        {driver.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {/* Timestamps */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[#1a1e2a] rounded-xl p-3">
              <p className="text-xs text-[#6b7280]">Posted</p>
              <p className="text-sm text-[#e8eaf0]">{formatDateTime(delivery.postedAt)}</p>
            </div>
            {delivery.deliveredAt && (
              <div className="bg-[#1a1e2a] rounded-xl p-3">
                <p className="text-xs text-[#6b7280]">Completed</p>
                <p className="text-sm text-[#e8eaf0]">{formatDateTime(delivery.deliveredAt)}</p>
              </div>
            )}
            {delivery.duration && (
              <div className="bg-[#1a1e2a] rounded-xl p-3">
                <p className="text-xs text-[#6b7280]">Duration</p>
                <p className="text-sm text-[#e8eaf0]">{delivery.duration}</p>
              </div>
            )}
          </div>

          {/* Proof photo */}
          {delivery.proofPhotoUrl && (
            <div>
              <h4 className="text-sm font-medium text-[#6b7280] mb-2">Proof of Delivery</h4>
              <img
                src={delivery.proofPhotoUrl}
                alt="Proof of delivery"
                className="w-full h-48 object-cover rounded-xl bg-[#1a1e2a]"
              />
            </div>
          )}

          {/* Status timeline */}
          <div>
            <h4 className="text-sm font-medium text-[#6b7280] mb-3">Status History</h4>
            <StatusTimeline events={[...delivery.statusHistory].reverse()} />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
