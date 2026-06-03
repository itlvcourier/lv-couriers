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
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom z-40">
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-0 gap-0.5 transition-colors duration-200 px-1',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <div className="relative">
                <Icon className="w-5 h-5 sm:w-6 sm:h-6" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center bg-primary text-primary-foreground text-[10px] font-bold rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              <span className="text-[10px] sm:text-xs font-medium truncate max-w-full">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
