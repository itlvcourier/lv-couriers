'use client'

import { cn } from '@/lib/utils'
import type { StatusEvent } from '@/lib/types'
import { getStatusLabel, formatDateTime } from '@/lib/delivery-utils'
import { StatusBadge } from './StatusBadge'

interface StatusTimelineProps {
  events: StatusEvent[]
  className?: string
}

export function StatusTimeline({ events, className }: StatusTimelineProps) {
  return (
    <div className={cn('flex flex-col', className)}>
      {events.map((event, index) => (
        <div key={`${event.status}-${event.timestamp}`} className="flex gap-3">
          {/* Timeline line and dot */}
          <div className="flex flex-col items-center">
            <div className="w-3 h-3 rounded-full bg-orange-500 mt-1.5" />
            {index < events.length - 1 && (
              <div className="w-0.5 flex-1 bg-[#1f2535] min-h-[32px]" />
            )}
          </div>
          {/* Event content */}
          <div className="pb-4 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={event.status} />
              <span className="text-xs text-[#6b7280]">
                {formatDateTime(event.timestamp)}
              </span>
            </div>
            {event.note && (
              <p className="text-sm text-[#6b7280] mt-1 italic">{event.note}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
