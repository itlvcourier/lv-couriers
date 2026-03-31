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
    <nav className="fixed bottom-0 left-0 right-0 bg-[#141720] border-t border-[#1f2535] safe-area-bottom z-40">
      <div className="flex items-center justify-around h-16">
        {items.map((item) => {
          const Icon = item.icon
          const isActive = activeTab === item.id
          
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-[64px] gap-0.5 transition-colors duration-200',
                isActive ? 'text-orange-500' : 'text-[#6b7280]'
              )}
            >
              <div className="relative">
                <Icon className="w-6 h-6" />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 flex items-center justify-center bg-orange-500 text-white text-[10px] font-bold rounded-full">
                    {item.badge}
                  </span>
                )}
              </div>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
