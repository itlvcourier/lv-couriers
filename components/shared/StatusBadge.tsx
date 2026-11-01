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
  claimed: 'bg-info/10 text-info border-info/20',
  assigned: 'bg-info/10 text-info border-info/20',
  en_route_pickup: 'bg-warning/10 text-warning border-warning/20',
  picked_up: 'bg-brand/10 text-brand border-brand/20',
  en_route_dropoff: 'bg-info/10 text-info border-info/20',
  in_transit: 'bg-info/10 text-info border-info/20',
  delivered: 'bg-success/10 text-success border-success/20',
  failed_retry: 'bg-destructive/10 text-destructive border-destructive/20',
  failed_permanent: 'bg-destructive/10 text-destructive border-destructive/20',
  flagged: 'bg-destructive/10 text-destructive border-destructive/20',
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

const statusTones: Record<string, 'moving' | 'done' | 'alert' | 'muted' | 'idle'> = {
  posted: 'idle',
  pending: 'idle',
  claimed: 'moving',
  assigned: 'moving',
  en_route_pickup: 'moving',
  picked_up: 'moving',
  en_route_dropoff: 'moving',
  in_transit: 'moving',
  delivered: 'done',
  failed_retry: 'alert',
  failed_permanent: 'alert',
  flagged: 'alert',
  cancelled: 'muted',
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status] || 'bg-gray-500/10 text-gray-400 border-gray-500/20'
  const label = statusLabels[status] || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  
  return (
    <span
      data-slot="status-badge"
      data-tone={statusTones[status] ?? 'idle'}
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
