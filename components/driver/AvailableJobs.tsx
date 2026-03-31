'use client'

import { useApp } from '@/lib/context'
import { DeliveryCard } from '@/components/shared/DeliveryCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Package, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

export function AvailableJobs() {
  const { deliveries, currentDriverId, claimDelivery, drivers } = useApp()
  
  // Get available jobs (posted status)
  const availableJobs = deliveries.filter(d => d.status === 'posted')
  
  // Check if driver has an active delivery
  const currentDriver = drivers.find(d => d.id === currentDriverId)
  const hasActiveDelivery = deliveries.some(
    d => d.driverId === currentDriverId && 
    !['delivered', 'failed', 'posted'].includes(d.status)
  )

  const handleClaim = (deliveryId: string) => {
    claimDelivery(deliveryId, currentDriverId)
    toast.success('Delivery claimed successfully')
  }

  return (
    <div className="flex flex-col h-full animate-fade-in">
      {/* Active delivery warning */}
      {hasActiveDelivery && (
        <div className="mx-4 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-400">You have an active delivery</p>
            <p className="text-xs text-yellow-400/70">Complete it before claiming a new one.</p>
          </div>
        </div>
      )}

      {/* Job list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
        {availableJobs.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No deliveries available"
            subtitle="Check back soon for new jobs"
          />
        ) : (
          availableJobs.map(delivery => (
            <DeliveryCard
              key={delivery.id}
              delivery={delivery}
              variant="driver"
              onClaim={() => handleClaim(delivery.id)}
              disabled={hasActiveDelivery}
            />
          ))
        )}
      </div>
    </div>
  )
}
