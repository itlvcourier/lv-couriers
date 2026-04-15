'use client'

import { cn } from '@/lib/utils'
import type { DeliveryStatus } from '@/lib/types'

interface StatusBadgeProps {
  status: DeliveryStatus | string
  className?: string
}

const statusStyles: Record<string, string> = {
  posted: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  pending: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  claimed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  assigned: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  en_route_pickup: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  picked_up: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  en_route_dropoff: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  in_transit: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  delivered: 'bg-green-500/10 text-green-400 border-green-500/20',
  failed_retry: 'bg-red-500/10 text-red-400 border-red-500/20',
  failed_permanent: 'bg-red-500/10 text-red-400 border-red-500/20',
  flagged: 'bg-red-500/10 text-red-400 border-red-500/20',
  cancelled: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
}

const statusLabels: Record<string, string> = {
  posted: 'Posted',
  pending: 'Pending',
  claimed: 'Claimed',
  assigned: 'Assigned',
  en_route_pickup: 'En Route to Pickup',
  picked_up: 'Picked Up',
  en_route_dropoff: 'En Route to Drop-off',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  failed_retry: 'Failed',
  failed_permanent: 'Failed',
  flagged: 'Flagged',
  cancelled: 'Cancelled',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border transition-all duration-200',
        style,
        className
      )}
    >
      {label}
    </span>
  )
}
