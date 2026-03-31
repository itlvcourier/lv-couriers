'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MapPin, Flag, ChevronDown, ChevronUp, AlertTriangle, Package, FileText, Truck as TruckIcon, Box } from 'lucide-react'
import type { Delivery, PackageType } from '@/lib/types'
import { StatusBadge } from './StatusBadge'
import { formatRelativeTime } from '@/lib/delivery-utils'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

interface DeliveryCardProps {
  delivery: Delivery
  variant: 'driver' | 'business' | 'admin'
  onClaim?: () => void
  onViewDetails?: () => void
  disabled?: boolean
  className?: string
}

const packageIcons: Record<PackageType, typeof Package> = {
  Document: FileText,
  Parcel: Package,
  Fragile: AlertTriangle,
  'Large Item': TruckIcon,
  Other: Box,
}

export function DeliveryCard({
  delivery,
  variant,
  onClaim,
  onViewDetails,
  disabled = false,
  className,
}: DeliveryCardProps) {
  const [expanded, setExpanded] = useState(false)
  const PackageIcon = packageIcons[delivery.packageType]

  return (
    <div
      className={cn(
        'bg-[#141720] border border-[#1f2535] rounded-2xl p-4 transition-all duration-200 hover:bg-[#1a1e2a] hover:scale-[1.01]',
        delivery.isUrgent && 'border-l-4 border-l-red-500',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-[#e8eaf0] truncate">{delivery.businessName}</h3>
            {delivery.isUrgent && (
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 animate-urgent-pulse">
                Urgent
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-[#1a1e2a] text-[#6b7280]">
              <PackageIcon className="w-3 h-3" />
              {delivery.packageType}
            </span>
            <span className="text-xs text-[#6b7280]">
              {formatRelativeTime(delivery.postedAt)}
            </span>
          </div>
        </div>
        {variant !== 'driver' && <StatusBadge status={delivery.status} />}
      </div>

      {/* Addresses */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <MapPin className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-[#e8eaf0] line-clamp-1">
            {expanded ? delivery.pickupAddress : delivery.pickupArea}
          </span>
        </div>
        <div className="flex items-start gap-2">
          <Flag className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <span className="text-sm text-[#e8eaf0] line-clamp-1">
            {expanded ? delivery.dropoffAddress : delivery.dropoffArea}
          </span>
        </div>
      </div>

      {/* Driver info for business/admin view */}
      {(variant === 'business' || variant === 'admin') && delivery.driverId && (
        <div className="flex items-center gap-2 mb-3 pt-2 border-t border-[#1f2535]">
          <Avatar className="w-6 h-6">
            <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xs">
              {delivery.driverName?.split(' ').map(n => n[0]).join('') || '?'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-[#e8eaf0]">{delivery.driverName}</span>
        </div>
      )}

      {/* Notes (if expanded or if notes exist and is short) */}
      {delivery.notes && (
        <p className={cn(
          'text-sm text-[#6b7280] italic mb-3',
          !expanded && 'line-clamp-1'
        )}>
          {delivery.notes}
        </p>
      )}

      {/* Expand/collapse and actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#1f2535]">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-[#6b7280] hover:text-[#e8eaf0] transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              Less
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              More
            </>
          )}
        </button>
        <div className="flex-1" />
        
        {variant === 'driver' && onClaim && (
          <Button
            onClick={onClaim}
            disabled={disabled}
            className="bg-orange-500 hover:bg-orange-600 text-white h-11 px-6 rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Claim Delivery
          </Button>
        )}
        
        {(variant === 'business' || variant === 'admin') && onViewDetails && (
          <Button
            onClick={onViewDetails}
            variant="outline"
            className="h-11 px-4 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
          >
            View Details
          </Button>
        )}
      </div>
    </div>
  )
}
