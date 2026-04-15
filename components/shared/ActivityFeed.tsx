'use client'

import { cn } from '@/lib/utils'
import { useApp } from '@/lib/context'
import { formatRelativeTime } from '@/lib/delivery-utils'
import { Separator } from '@/components/ui/separator'
import { 
  MapPin, 
  Smartphone, 
  Battery, 
  Clock, 
  Mail, 
  Eye, 
  Package, 
  CheckCircle 
} from 'lucide-react'
import type { ActivityFeedItem } from '@/lib/types'

interface ActivityFeedProps {
  maxItems?: number
  className?: string
}

const typeColors: Record<ActivityFeedItem['type'], string> = {
  status_change: 'bg-blue-500/20 text-blue-400',
  gps_update: 'bg-orange-500/20 text-orange-400',
  sms_sent: 'bg-green-500/20 text-green-400',
  battery_warning: 'bg-yellow-500/20 text-yellow-400',
  timeout_warning: 'bg-red-500/20 text-red-400',
  email_bounced: 'bg-red-500/20 text-red-400',
  tracking_opened: 'bg-purple-500/20 text-purple-400',
}

const typeIcons: Record<ActivityFeedItem['type'], React.ElementType> = {
  status_change: Package,
  gps_update: MapPin,
  sms_sent: Smartphone,
  battery_warning: Battery,
  timeout_warning: Clock,
  email_bounced: Mail,
  tracking_opened: Eye,
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
      {items.map((event, index) => {
        const Icon = typeIcons[event.type] || Package
        const colorClass = typeColors[event.type] || 'bg-gray-500/20 text-gray-400'
        
        return (
          <div key={event.id}>
            <div className="flex items-start gap-3 py-3">
              <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', colorClass)}>
                <Icon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[#e8eaf0]">
                  {event.message}
                </p>
                <p className="text-xs text-[#6b7280] mt-0.5">
                  {formatRelativeTime(event.timestamp)}
                </p>
              </div>
            </div>
            {index < items.length - 1 && <Separator className="bg-[#1f2535]" />}
          </div>
        )
      })}
    </div>
  )
}
