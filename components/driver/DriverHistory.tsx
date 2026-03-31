'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { StatusTimeline } from '@/components/shared/StatusTimeline'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { History, Clock, Package, ChevronRight, MapPin } from 'lucide-react'
import { formatRelativeTime, formatDateTime } from '@/lib/delivery-utils'
import type { Delivery } from '@/lib/types'

export function DriverHistory() {
  const { deliveries, currentDriverId, drivers } = useApp()
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)

  const currentDriver = drivers.find(d => d.id === currentDriverId)

  // Get completed deliveries for current driver
  const completedDeliveries = deliveries.filter(
    d => d.driverId === currentDriverId && 
    (d.status === 'delivered' || d.status === 'failed')
  )

  // Sort by most recent first
  const sortedDeliveries = [...completedDeliveries].sort(
    (a, b) => new Date(b.deliveredAt || b.postedAt).getTime() - new Date(a.deliveredAt || a.postedAt).getTime()
  )

  // Calculate today's count
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const todayCount = sortedDeliveries.filter(d => {
    const deliveredDate = new Date(d.deliveredAt || d.postedAt)
    return deliveredDate >= today
  }).length

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Stats strip */}
      <div className="mx-4 mt-4 bg-[#141720] border border-[#1f2535] rounded-2xl p-4">
        <div className="flex items-center justify-between">
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-[#e8eaf0]">{todayCount}</p>
            <p className="text-xs text-[#6b7280]">Today</p>
          </div>
          <div className="w-px h-10 bg-[#1f2535]" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-[#e8eaf0]">{currentDriver?.totalDeliveries || 0}</p>
            <p className="text-xs text-[#6b7280]">Total</p>
          </div>
          <div className="w-px h-10 bg-[#1f2535]" />
          <div className="text-center flex-1">
            <p className="text-2xl font-bold text-orange-500">{currentDriver?.averageTime || '--'}</p>
            <p className="text-xs text-[#6b7280]">Avg Time</p>
          </div>
        </div>
      </div>

      {/* History list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {sortedDeliveries.length === 0 ? (
          <EmptyState
            icon={History}
            title="No delivery history"
            subtitle="Completed deliveries will appear here"
          />
        ) : (
          sortedDeliveries.map(delivery => (
            <button
              key={delivery.id}
              onClick={() => setSelectedDelivery(delivery)}
              className="w-full bg-[#141720] border border-[#1f2535] rounded-2xl p-4 text-left transition-all duration-200 hover:bg-[#1a1e2a] hover:scale-[1.01]"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-semibold text-[#e8eaf0]">{delivery.businessName}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <MapPin className="w-3 h-3 text-[#6b7280]" />
                    <span className="text-sm text-[#6b7280]">{delivery.dropoffArea}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={delivery.status} />
                  <ChevronRight className="w-4 h-4 text-[#6b7280]" />
                </div>
              </div>
              
              <div className="flex items-center gap-4 pt-2 border-t border-[#1f2535]">
                <div className="flex items-center gap-1 text-xs text-[#6b7280]">
                  <Clock className="w-3 h-3" />
                  {delivery.deliveredAt ? formatRelativeTime(delivery.deliveredAt) : '--'}
                </div>
                {delivery.duration && (
                  <div className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                    <Package className="w-3 h-3" />
                    {delivery.duration}
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Detail sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <SheetContent side="bottom" className="bg-[#141720] border-t border-[#1f2535] rounded-t-3xl max-h-[80vh] overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="text-[#e8eaf0] flex items-center justify-between">
                  <span>{selectedDelivery.businessName}</span>
                  <StatusBadge status={selectedDelivery.status} />
                </SheetTitle>
              </SheetHeader>
              
              <div className="space-y-4">
                {/* Package info */}
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-[#1a1e2a] text-[#e8eaf0]">
                    {selectedDelivery.packageType}
                  </span>
                  {selectedDelivery.duration && (
                    <span className="px-3 py-1 rounded-full text-sm font-medium bg-orange-500/10 text-orange-400">
                      {selectedDelivery.duration}
                    </span>
                  )}
                </div>

                {/* Addresses */}
                <div className="bg-[#1a1e2a] rounded-xl p-3 space-y-2">
                  <div>
                    <p className="text-xs text-[#6b7280]">Pickup</p>
                    <p className="text-sm text-[#e8eaf0]">{selectedDelivery.pickupAddress}</p>
                  </div>
                  <div className="border-t border-[#1f2535] pt-2">
                    <p className="text-xs text-[#6b7280]">Drop-off</p>
                    <p className="text-sm text-[#e8eaf0]">{selectedDelivery.dropoffAddress}</p>
                  </div>
                </div>

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
                </div>

                {/* Proof photo */}
                {selectedDelivery.proofPhotoUrl && (
                  <div>
                    <p className="text-xs text-[#6b7280] mb-2">Proof of Delivery</p>
                    <img
                      src={selectedDelivery.proofPhotoUrl}
                      alt="Proof of delivery"
                      className="w-full h-40 object-cover rounded-xl bg-[#1a1e2a]"
                    />
                  </div>
                )}

                {/* Timeline */}
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
