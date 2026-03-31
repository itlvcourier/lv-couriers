'use client'

import { cn } from '@/lib/utils'
import { useApp, type ActivityEvent } from '@/lib/context'
import { formatRelativeTime } from '@/lib/delivery-utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'

interface ActivityFeedProps {
  maxItems?: number
  className?: string
}

const statusColors: Record<string, string> = {
  posted: 'bg-gray-500',
  claimed: 'bg-blue-500',
  en_route_pickup: 'bg-yellow-500',
  picked_up: 'bg-orange-500',
  en_route_dropoff: 'bg-purple-500',
  delivered: 'bg-green-500',
  failed: 'bg-red-500',
}

export function ActivityFeed({ maxItems = 10, className }: ActivityFeedProps) {
  const { activityFeed } = useApp()
  const items = activityFeed.slice(0, maxItems)

  if (items.length === 0) {
    return (
      <div className={cn('text-center py-8 text-[#6b7280]', className)}>
        <p className="text-sm">No recent activity</p>
      </div>
    )
  }

  return (
    <div className={cn('space-y-0', className)}>
      {items.map((event, index) => (
        <div key={event.id}>
          <div className="flex items-start gap-3 py-3">
            <Avatar className="w-8 h-8 flex-shrink-0">
              <AvatarFallback className={cn('text-xs text-white', statusColors[event.status])}>
                {event.driverAvatar || '?'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-[#e8eaf0]">
                <span className="font-medium">{event.driverName || 'System'}</span>
                {' '}{event.action}{' '}
                <span className="text-[#6b7280]">{event.businessName}</span>
              </p>
              <p className="text-xs text-[#6b7280] mt-0.5">
                {formatRelativeTime(event.timestamp)}
              </p>
            </div>
          </div>
          {index < items.length - 1 && <Separator className="bg-[#1f2535]" />}
        </div>
      ))}
    </div>
  )
}
