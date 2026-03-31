'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface StatCardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconColor?: string
  className?: string
}

export function StatCard({ title, value, icon: Icon, iconColor = 'text-orange-500', className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-[#141720] border border-[#1f2535] rounded-2xl p-4 transition-all duration-200 hover:bg-[#1a1e2a]',
        className
      )}
    >
      <div className="flex items-center gap-3">
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center bg-[#1a1e2a]')}>
          <Icon className={cn('w-5 h-5', iconColor)} />
        </div>
        <div>
          <p className="text-sm text-[#6b7280]">{title}</p>
          <p className="text-2xl font-bold text-[#e8eaf0]">{value}</p>
        </div>
      </div>
    </div>
  )
}
