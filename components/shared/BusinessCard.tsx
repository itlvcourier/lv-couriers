'use client'

import { cn } from '@/lib/utils'
import type { Business } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Phone, Mail, Package, Clock } from 'lucide-react'
import { formatRelativeTime } from '@/lib/delivery-utils'

interface BusinessCardProps {
  business: Business
  onViewDeliveries?: () => void
  className?: string
}

export function BusinessCard({ business, onViewDeliveries, className }: BusinessCardProps) {
  const initials = business.name.split(' ').map(w => w[0]).join('').slice(0, 2)

  return (
    <div
      className={cn(
        'bg-[#141720] border border-[#1f2535] rounded-2xl p-4 transition-all duration-200 hover:bg-[#1a1e2a] hover:scale-[1.01]',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-4">
        <Avatar className="w-12 h-12">
          <AvatarFallback className="bg-blue-500/20 text-blue-400 text-sm font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-[#e8eaf0] truncate">{business.name}</h3>
          <p className="text-sm text-[#6b7280]">{business.contactName}</p>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-[#1a1e2a]">
          <Package className="w-3 h-3 text-orange-500" />
          <span className="text-sm font-semibold text-[#e8eaf0]">{business.totalDeliveries}</span>
        </div>
      </div>

      {/* Contact info */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <Phone className="w-4 h-4 text-[#6b7280]" />
          <span className="text-[#e8eaf0]">{business.phone}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Mail className="w-4 h-4 text-[#6b7280]" />
          <span className="text-[#e8eaf0] truncate">{business.email}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Clock className="w-4 h-4 text-[#6b7280]" />
          <span className="text-[#6b7280]">Last active {formatRelativeTime(business.lastActive)}</span>
        </div>
      </div>

      {/* Action */}
      <Button
        onClick={onViewDeliveries}
        className="w-full h-11 rounded-xl bg-[#1f2535] hover:bg-[#2a3040] text-[#e8eaf0] font-medium"
      >
        View Deliveries
      </Button>
    </div>
  )
}
