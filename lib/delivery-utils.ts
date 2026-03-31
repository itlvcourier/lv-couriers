import type { DeliveryStatus, PackageType } from './types'

export function getStatusLabel(status: DeliveryStatus): string {
  const labels: Record<DeliveryStatus, string> = {
    posted: 'Posted',
    claimed: 'Claimed',
    en_route_pickup: 'En Route to Pickup',
    picked_up: 'Picked Up',
    en_route_dropoff: 'En Route to Drop-off',
    delivered: 'Delivered',
    failed: 'Failed',
  }
  return labels[status]
}

export function getNextStatus(current: DeliveryStatus): DeliveryStatus | null {
  const progression: Record<DeliveryStatus, DeliveryStatus | null> = {
    posted: 'claimed',
    claimed: 'en_route_pickup',
    en_route_pickup: 'picked_up',
    picked_up: 'en_route_dropoff',
    en_route_dropoff: 'delivered',
    delivered: null,
    failed: null,
  }
  return progression[current]
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins} min ago`
  if (diffHours < 24) return `${diffHours} hr ago`
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays} days ago`
}

export function formatDateTime(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleString('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatTime(isoDate: string): string {
  const date = new Date(isoDate)
  return date.toLocaleTimeString('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function calculateDuration(startIso: string, endIso: string): string {
  const start = new Date(startIso)
  const end = new Date(endIso)
  const diffMs = end.getTime() - start.getTime()
  const diffMins = Math.round(diffMs / (1000 * 60))
  return `${diffMins} min`
}

export function getTimeElapsed(isoDate: string): string {
  const date = new Date(isoDate)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / (1000 * 60))
  const hours = Math.floor(diffMins / 60)
  const mins = diffMins % 60

  if (hours > 0) {
    return `${hours}h ${mins}m`
  }
  return `${mins}m`
}

export function getPackageIcon(packageType: PackageType): string {
  const icons: Record<PackageType, string> = {
    Document: 'FileText',
    Parcel: 'Package',
    Fragile: 'AlertTriangle',
    'Large Item': 'Truck',
    Other: 'Box',
  }
  return icons[packageType]
}

export function isActiveStatus(status: DeliveryStatus): boolean {
  return !['delivered', 'failed', 'posted'].includes(status)
}

export function isCompletedStatus(status: DeliveryStatus): boolean {
  return status === 'delivered' || status === 'failed'
}

export function generateDeliveryId(): string {
  const num = Math.floor(Math.random() * 900) + 100
  return `del-${num}`
}

export function getStatusIndex(status: DeliveryStatus): number {
  const order: DeliveryStatus[] = [
    'posted',
    'claimed',
    'en_route_pickup',
    'picked_up',
    'en_route_dropoff',
    'delivered',
  ]
  return order.indexOf(status)
}

export const statusSteps: { status: DeliveryStatus; label: string }[] = [
  { status: 'claimed', label: 'Claimed' },
  { status: 'en_route_pickup', label: 'En Route to Pickup' },
  { status: 'picked_up', label: 'Picked Up' },
  { status: 'en_route_dropoff', label: 'En Route to Drop-off' },
  { status: 'delivered', label: 'Delivered' },
]
