'use client'

import { cn } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  id: string
  label: string
  icon: LucideIcon
  badge?: number
}

interface BottomNavProps {
  items: NavItem[]
  activeTab: string
  onTabChange: (tab: string) => void
}

export function BottomNav({ items, activeTab, onTabChange }: BottomNavProps) {
  return (
    <nav
      aria-label="Primary"
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/85 backdrop-blur-xl safe-area-bottom"
    >
      <div className="mx-auto flex h-16 max-w-lg items-center justify-around px-2">
        {items.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'relative flex h-full min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span
                className={cn(
                  'absolute top-0 h-0.5 w-8 rounded-full transition-colors',
                  isActive ? 'bg-brand' : 'bg-transparent',
                )}
                aria-hidden="true"
              />
              <span className="relative">
                <Icon className="h-5 w-5" strokeWidth={isActive ? 2.2 : 1.8} aria-hidden="true" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-semibold tabular-nums text-brand-foreground">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </span>
              <span className={cn('max-w-full truncate text-[11px]', isActive ? 'font-semibold' : 'font-medium')}>
                {item.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
