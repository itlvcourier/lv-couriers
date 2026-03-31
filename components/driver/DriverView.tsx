'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { BottomNav, type NavItem } from '@/components/shared/BottomNav'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDelivery } from './ActiveDelivery'
import { DriverHistory } from './DriverHistory'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Truck, FolderOpen, Package, History } from 'lucide-react'

type DriverTab = 'available' | 'active' | 'history'

export function DriverView() {
  const [activeTab, setActiveTab] = useState<DriverTab>('available')
  const { deliveries, drivers, currentDriverId } = useApp()

  const currentDriver = drivers.find(d => d.id === currentDriverId)

  // Count available jobs
  const availableCount = deliveries.filter(d => d.status === 'posted').length

  const navItems: NavItem[] = [
    { id: 'available', label: 'Available', icon: FolderOpen, badge: availableCount },
    { id: 'active', label: 'Active', icon: Package },
    { id: 'history', label: 'History', icon: History },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0d0f14]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-16 bg-[#141720] border-b border-[#1f2535]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
            <Truck className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[#e8eaf0]">DOMS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#6b7280] hidden sm:block">{currentDriver?.name}</span>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-orange-500/20 text-orange-500 text-xs font-semibold">
              {currentDriver?.avatar || '?'}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'available' && <AvailableJobs />}
        {activeTab === 'active' && <ActiveDelivery />}
        {activeTab === 'history' && <DriverHistory />}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        items={navItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as DriverTab)}
      />
    </div>
  )
}
