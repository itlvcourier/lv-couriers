'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { BottomNav, type NavItem } from '@/components/shared/BottomNav'
import { PostDelivery } from './PostDelivery'
import { MyDeliveries } from './MyDeliveries'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Building2, PlusCircle, ClipboardList } from 'lucide-react'

type BusinessTab = 'post' | 'deliveries'

export function BusinessView() {
  const [activeTab, setActiveTab] = useState<BusinessTab>('post')
  const { businesses, activeBusinessId } = useApp()

  const currentBusiness = businesses.find(b => b.id === activeBusinessId)
  const initials = currentBusiness?.name.split(' ').map(w => w[0]).join('').slice(0, 2) || '??'

  const navItems: NavItem[] = [
    { id: 'post', label: 'New Delivery', icon: PlusCircle },
    { id: 'deliveries', label: 'My Deliveries', icon: ClipboardList },
  ]

  return (
    <div className="flex flex-col h-screen bg-[#0d0f14]">
      {/* Header */}
      <header className="flex items-center justify-between px-4 h-16 bg-[#141720] border-b border-[#1f2535]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <span className="text-lg font-bold text-[#e8eaf0]">DOMS</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-[#6b7280] hidden sm:block">{currentBusiness?.name}</span>
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-blue-500/20 text-blue-400 text-xs font-semibold">
              {initials}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      {/* Tab content */}
      <main className="flex-1 overflow-hidden">
        {activeTab === 'post' && (
          <PostDelivery onSwitchToDeliveries={() => setActiveTab('deliveries')} />
        )}
        {activeTab === 'deliveries' && <MyDeliveries />}
      </main>

      {/* Bottom navigation */}
      <BottomNav
        items={navItems}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as BusinessTab)}
      />
    </div>
  )
}
