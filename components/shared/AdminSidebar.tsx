'use client'

import { cn } from '@/lib/utils'
import { LayoutDashboard, Truck, ClipboardList, Users, Building2, PlusCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type AdminPage = 'dashboard' | 'active' | 'all' | 'drivers' | 'businesses' | 'post'

interface NavItem {
  id: AdminPage
  label: string
  icon: LucideIcon
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'active', label: 'Active Deliveries', icon: Truck },
  { id: 'all', label: 'All Deliveries', icon: ClipboardList },
  { id: 'drivers', label: 'Drivers', icon: Users },
  { id: 'businesses', label: 'Businesses', icon: Building2 },
  { id: 'post', label: 'Post Job', icon: PlusCircle },
]

interface AdminSidebarProps {
  activePage: AdminPage
  onPageChange: (page: AdminPage) => void
}

export function AdminSidebar({ activePage, onPageChange }: AdminSidebarProps) {
  return (
    <aside className="hidden lg:flex flex-col w-60 h-screen bg-[#141720] border-r border-[#1f2535] fixed left-0 top-0 z-30">
      {/* Logo */}
      <div className="h-16 flex items-center px-6 border-b border-[#1f2535]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[#e8eaf0]">DOMS</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200',
                isActive
                  ? 'bg-orange-500/10 text-orange-500'
                  : 'text-[#6b7280] hover:text-[#e8eaf0] hover:bg-[#1a1e2a]'
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#1f2535]">
        <p className="text-xs text-[#6b7280] text-center">LV Couriers v1.0</p>
      </div>
    </aside>
  )
}

// Mobile bottom nav for admin
export function AdminBottomNav({ activePage, onPageChange }: AdminSidebarProps) {
  const mobileItems = navItems.slice(0, 5) // Show first 5 items on mobile

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#141720] border-t border-[#1f2535] safe-area-bottom z-40">
      <div className="flex items-center justify-around h-16">
        {mobileItems.map((item) => {
          const Icon = item.icon
          const isActive = activePage === item.id

          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={cn(
                'flex flex-col items-center justify-center flex-1 h-full min-w-[48px] gap-0.5 transition-colors duration-200',
                isActive ? 'text-orange-500' : 'text-[#6b7280]'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium">{item.label.split(' ')[0]}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
