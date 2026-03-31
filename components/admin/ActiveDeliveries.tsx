'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { DeliveryCard } from '@/components/shared/DeliveryCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { LayoutGrid, List, Clock, AlertCircle, Package } from 'lucide-react'
import { getTimeElapsed, isCompletedStatus } from '@/lib/delivery-utils'
import { cn } from '@/lib/utils'
import type { Delivery, DeliveryStatus } from '@/lib/types'
import { toast } from 'sonner'

type ViewMode = 'grid' | 'table'

const statusFilters: { value: DeliveryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Active' },
  { value: 'posted', label: 'Posted' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'en_route_pickup', label: 'En Route to Pickup' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'en_route_dropoff', label: 'En Route to Drop-off' },
]

interface ActiveDeliveriesProps {
  onViewDelivery: (delivery: Delivery) => void
}

export function ActiveDeliveries({ onViewDelivery }: ActiveDeliveriesProps) {
  const { deliveries, drivers, reassignDriver } = useApp()
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')

  const availableDrivers = drivers.filter(d => d.status === 'available')

  const activeDeliveries = useMemo(() => {
    let filtered = deliveries.filter(d => !isCompletedStatus(d.status))
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter)
    }
    
    return filtered.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  }, [deliveries, statusFilter])

  const handleReassign = (deliveryId: string, driverId: string) => {
    reassignDriver(deliveryId, driverId)
    toast.success('Driver reassigned')
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-xl font-bold text-[#e8eaf0]">Active Deliveries</h1>
        
        <div className="flex items-center gap-3">
          {/* Status filter chips */}
          <div className="hidden lg:flex items-center gap-2 overflow-x-auto no-scrollbar">
            {statusFilters.map(filter => (
              <button
                key={filter.value}
                onClick={() => setStatusFilter(filter.value)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
                  statusFilter === filter.value
                    ? 'bg-orange-500 text-white'
                    : 'bg-[#1a1e2a] text-[#6b7280] hover:text-[#e8eaf0]'
                )}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Mobile filter dropdown */}
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DeliveryStatus | 'all')}>
            <SelectTrigger className="lg:hidden w-[160px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141720] border-[#1f2535]">
              {statusFilters.map(filter => (
                <SelectItem
                  key={filter.value}
                  value={filter.value}
                  className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                >
                  {filter.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* View toggle */}
          <div className="hidden lg:flex items-center gap-1 p-1 bg-[#1a1e2a] rounded-lg">
            <button
              onClick={() => setViewMode('grid')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'grid' ? 'bg-orange-500 text-white' : 'text-[#6b7280] hover:text-[#e8eaf0]'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={cn(
                'p-2 rounded-md transition-colors',
                viewMode === 'table' ? 'bg-orange-500 text-white' : 'text-[#6b7280] hover:text-[#e8eaf0]'
              )}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {activeDeliveries.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No active deliveries"
          subtitle={statusFilter === 'all' ? 'All deliveries are completed' : 'No deliveries match this filter'}
        />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {activeDeliveries.map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              variant="admin"
              onViewDetails={() => onViewDelivery(delivery)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1f2535]">
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">ID</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Business</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Pickup</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Drop-off</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Driver</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Status</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Elapsed</th>
                <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Reassign</th>
              </tr>
            </thead>
            <tbody>
              {activeDeliveries.map(delivery => (
                <tr
                  key={delivery.id}
                  className="border-b border-[#1f2535] hover:bg-[#1a1e2a] transition-colors"
                >
                  <td className="px-4 py-3 text-sm text-[#e8eaf0] font-mono">{delivery.id}</td>
                  <td className="px-4 py-3 text-sm text-[#e8eaf0]">{delivery.businessName}</td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">{delivery.pickupArea}</td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">{delivery.dropoffArea}</td>
                  <td className="px-4 py-3 text-sm">
                    {delivery.driverName ? (
                      <span className="text-[#e8eaf0]">{delivery.driverName}</span>
                    ) : (
                      <span className="text-red-400 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        Unassigned
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={delivery.status} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[#6b7280]">
                    {getTimeElapsed(delivery.postedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Select onValueChange={(driverId) => handleReassign(delivery.id, driverId)}>
                      <SelectTrigger className="w-[140px] h-8 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] text-xs">
                        <SelectValue placeholder="Reassign..." />
                      </SelectTrigger>
                      <SelectContent className="bg-[#141720] border-[#1f2535]">
                        {availableDrivers.length === 0 ? (
                          <SelectItem value="none" disabled className="text-[#6b7280]">
                            No drivers available
                          </SelectItem>
                        ) : (
                          availableDrivers.map(driver => (
                            <SelectItem
                              key={driver.id}
                              value={driver.id}
                              className="text-[#e8eaf0] focus:bg-[#1a1e2a] focus:text-[#e8eaf0]"
                            >
                              {driver.name}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
