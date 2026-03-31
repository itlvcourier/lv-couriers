'use client'

import { cn } from '@/lib/utils'
import type { Driver, DriverStatus } from '@/lib/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Clock, Package, History } from 'lucide-react'

interface DriverCardProps {
  driver: Driver
  onToggleStatus?: () => void
  onViewHistory?: () => void
  className?: string
}

const statusConfig: Record<DriverStatus, { label: string; color: string; bgColor: string }> = {
  available: { label: 'Available', color: 'text-green-400', bgColor: 'bg-green-500' },
  on_delivery: { label: 'On Delivery', color: 'text-orange-400', bgColor: 'bg-orange-500' },
  off_duty: { label: 'Off Duty', color: 'text-gray-400', bgColor: 'bg-gray-500' },
}

export function DriverCard({ driver, onToggleStatus, onViewHistory, className }: DriverCardProps) {
  const status = statusConfig[driver.status]

  return (
    <div
      className={cn(
        'bg-[#141720] border border-[#1f2535] rounded-2xl p-4 transition-all duration-200 hover:bg-[#1a1e2a] hover:scale-[1.01]',
        className
      )}
    >
      {/* Header with avatar and status */}
      <div className="flex items-center gap-3 mb-4">
        <Avatar className="w-12 h-12">
          <AvatarFallback className={cn('text-sm font-semibold text-white', status.bgColor)}>
            {driver.avatar}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="font-semibold text-[#e8eaf0]">{driver.name}</h3>
          <span className={cn('text-sm font-medium', status.color)}>
            {status.label}
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-[#1a1e2a] rounded-xl p-2 text-center">
          <p className="text-lg font-bold text-[#e8eaf0]">{driver.todayDeliveries}</p>
          <p className="text-xs text-[#6b7280]">Today</p>
        </div>
        <div className="bg-[#1a1e2a] rounded-xl p-2 text-center">
          <p className="text-lg font-bold text-[#e8eaf0]">{driver.totalDeliveries}</p>
          <p className="text-xs text-[#6b7280]">Total</p>
        </div>
        <div className="bg-[#1a1e2a] rounded-xl p-2 text-center">
          <p className="text-lg font-bold text-[#e8eaf0]">{driver.averageTime}</p>
          <p className="text-xs text-[#6b7280]">Avg</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-3 border-t border-[#1f2535]">
        <div className="flex items-center gap-2">
          <Switch
            checked={driver.status === 'available'}
            onCheckedChange={onToggleStatus}
            disabled={driver.status === 'on_delivery'}
          />
          <span className="text-xs text-[#6b7280]">
            {driver.status === 'on_delivery' ? 'Busy' : 'Available'}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onViewHistory}
          className="h-9 px-3 rounded-xl border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0]"
        >
          <History className="w-4 h-4 mr-1" />
          History
        </Button>
      </div>
    </div>
  )
}
