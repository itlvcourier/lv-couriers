'use client'

import { cn } from '@/lib/utils'
import type { DeliveryStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: DeliveryStatus
  className?: string
}

const statusStyles: Record<DeliveryStatus, string> = {
  posted: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  claimed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  en_route_pickup: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  picked_up: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  en_route_dropoff: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const statusLabels: Record<DeliveryStatus, string> = {
  posted: 'Posted',
  claimed: 'Claimed',
  en_route_pickup: 'En Route to Pickup',
  picked_up: 'Picked Up',
  en_route_dropoff: 'En Route to Drop-off',
  delivered: 'Delivered',
  failed: 'Failed',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border transition-all duration-200',
        statusStyles[status],
        className
      )}
    >
      {statusLabels[status]}
    </span>
  )
}
