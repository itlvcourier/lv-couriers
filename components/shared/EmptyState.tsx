'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  action?: React.ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, subtitle, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center py-12 px-4 text-center animate-fade-in',
        className
      )}
    >
      <div className="w-16 h-16 rounded-full bg-[#1a1e2a] flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#6b7280]" />
      </div>
      <h3 className="text-lg font-semibold text-[#e8eaf0] mb-1">{title}</h3>
      {subtitle && (
        <p className="text-sm text-[#6b7280] max-w-xs">{subtitle}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
