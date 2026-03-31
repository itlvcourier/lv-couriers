'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatusTimeline } from '@/components/shared/StatusTimeline'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Package, MapPin, Flag, Phone, Clock } from 'lucide-react'
import { formatRelativeTime, formatDateTime, isCompletedStatus, isActiveStatus } from '@/lib/delivery-utils'
import { cn } from '@/lib/utils'
import type { Delivery, DeliveryStatus } from '@/lib/types'

type FilterTab = 'all' | 'active' | 'completed'

export function MyDeliveries() {
  const { deliveries, activeBusinessId, drivers } = useApp()
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)

  // Get deliveries for current business
  const myDeliveries = useMemo(() => {
    return deliveries
      .filter(d => d.businessId === activeBusinessId)
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  }, [deliveries, activeBusinessId])

  // Apply filter
  const filteredDeliveries = useMemo(() => {
    switch (activeFilter) {
      case 'active':
        return myDeliveries.filter(d => !isCompletedStatus(d.status))
      case 'completed':
        return myDeliveries.filter(d => isCompletedStatus(d.status))
      default:
        return myDeliveries
    }
  }, [myDeliveries, activeFilter])

  const filterTabs: { id: FilterTab; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: myDeliveries.length },
    { id: 'active', label: 'Active', count: myDeliveries.filter(d => !isCompletedStatus(d.status)).length },
    { id: 'completed', label: 'Completed', count: myDeliveries.filter(d => isCompletedStatus(d.status)).length },
  ]

  const getDriver = (driverId: string | null) => {
    if (!driverId) return null
    return drivers.find(d => d.id === driverId)
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Filter tabs */}
      <div className="px-4 pt-4">
        <div className="flex gap-2 p-1 bg-[#141720] rounded-xl">
          {filterTabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                activeFilter === tab.id
                  ? 'bg-orange-500 text-white'
                  : 'text-[#6b7280] hover:text-[#e8eaf0]'
              )}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>
      </div>

      {/* Delivery list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {filteredDeliveries.length === 0 ? (
          <EmptyState
            icon={Package}
            title={`No ${activeFilter === 'all' ? '' : activeFilter} deliveries`}
            subtitle={activeFilter === 'all' ? 'Post a delivery to get started' : 'Check other tabs'}
          />
        ) : (
          filteredDeliveries.map(delivery => (
            <button
              key={delivery.id}
              onClick={() => setSelectedDelivery(delivery)}
              className={cn(
                'w-full bg-[#141720] border border-[#1f2535] rounded-2xl p-4 text-left transition-all duration-200 hover:bg-[#1a1e2a] hover:scale-[1.01]',
                delivery.isUrgent && 'border-l-4 border-l-orange-500'
              )}
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flag className="w-4 h-4 text-green-400" />
                  <span className="font-medium text-[#e8eaf0]">{delivery.dropoffArea}</span>
                </div>
                <StatusBadge status={delivery.status} />
              </div>

              {/* Driver info */}
              <div className="flex items-center gap-2 mb-2">
                {delivery.driverId ? (
                  <>
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xs">
                        {delivery.driverName?.split(' ').map(n => n[0]).join('') || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-[#e8eaf0]">{delivery.driverName}</span>
                  </>
                ) : (
                  <span className="text-sm text-[#6b7280] italic">Awaiting driver...</span>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 pt-2 border-t border-[#1f2535]">
                <span className="text-xs text-[#6b7280]">
                  <Clock className="w-3 h-3 inline mr-1" />
                  {formatRelativeTime(delivery.postedAt)}
                </span>
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-[#1a1e2a] text-[#6b7280]">
                  {delivery.packageType}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <SheetContent side="bottom" className="bg-[#141720] border-t border-[#1f2535] rounded-t-3xl max-h-[85vh] overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle className="text-[#e8eaf0]">Delivery Details</SheetTitle>
                  <StatusBadge status={selectedDelivery.status} />
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {/* Package info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a1e2a] text-[#e8eaf0]">
                    <Package className="w-3 h-3 inline mr-1" />
                    {selectedDelivery.packageType}
                  </span>
                  {selectedDelivery.isUrgent && (
                    <span className="px-3 py-1 rounded-full text-sm font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
                      Urgent
                    </span>
                  )}
                </div>

                {/* Addresses */}
                <div className="bg-[#1a1e2a] rounded-xl p-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#6b7280] mb-1">
                      <MapPin className="w-3 h-3 text-blue-400" />
                      Pickup
                    </div>
                    <p className="text-sm text-[#e8eaf0]">{selectedDelivery.pickupAddress}</p>
                  </div>
                  <div className="border-t border-[#1f2535] pt-3">
                    <div className="flex items-center gap-2 text-xs text-[#6b7280] mb-1">
                      <Flag className="w-3 h-3 text-green-400" />
                      Drop-off
                    </div>
                    <p className="text-sm text-[#e8eaf0]">{selectedDelivery.dropoffAddress}</p>
                  </div>
                </div>

                {/* Notes */}
                {selectedDelivery.notes && (
                  <div>
                    <p className="text-xs text-[#6b7280] mb-1">Notes</p>
                    <p className="text-sm text-[#e8eaf0] italic bg-[#1a1e2a] rounded-xl p-3">
                      {selectedDelivery.notes}
                    </p>
                  </div>
                )}

                {/* Driver info */}
                {selectedDelivery.driverId && (
                  <div className="bg-[#1a1e2a] rounded-xl p-4">
                    <p className="text-xs text-[#6b7280] mb-2">Assigned Driver</p>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-orange-500/20 text-orange-500">
                          {selectedDelivery.driverName?.split(' ').map(n => n[0]).join('') || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#e8eaf0]">{selectedDelivery.driverName}</p>
                        <p className="text-xs text-[#6b7280] flex items-center gap-1">
                          <Phone className="w-3 h-3" />
                          {getDriver(selectedDelivery.driverId)?.phone}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[#1a1e2a] rounded-xl p-3">
                    <p className="text-xs text-[#6b7280]">Posted</p>
                    <p className="text-sm text-[#e8eaf0]">{formatDateTime(selectedDelivery.postedAt)}</p>
                  </div>
                  {selectedDelivery.deliveredAt && (
                    <div className="bg-[#1a1e2a] rounded-xl p-3">
                      <p className="text-xs text-[#6b7280]">Completed</p>
                      <p className="text-sm text-[#e8eaf0]">{formatDateTime(selectedDelivery.deliveredAt)}</p>
                    </div>
                  )}
                  {selectedDelivery.duration && (
                    <div className="bg-[#1a1e2a] rounded-xl p-3">
                      <p className="text-xs text-[#6b7280]">Duration</p>
                      <p className="text-sm text-orange-500 font-medium">{selectedDelivery.duration}</p>
                    </div>
                  )}
                </div>

                {/* Proof photo */}
                {selectedDelivery.proofPhotoUrl && (
                  <div>
                    <p className="text-xs text-[#6b7280] mb-2">Proof of Delivery</p>
                    <img
                      src={selectedDelivery.proofPhotoUrl}
                      alt="Proof of delivery"
                      className="w-full h-48 object-cover rounded-xl bg-[#1a1e2a]"
                    />
                  </div>
                )}

                {/* Status timeline */}
                <div>
                  <p className="text-xs text-[#6b7280] mb-2">Status History</p>
                  <StatusTimeline events={[...selectedDelivery.statusHistory].reverse()} />
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
