'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { BottomNav } from '@/components/shared/BottomNav'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDelivery } from './ActiveDelivery'
import { DriverHistory } from './DriverHistory'
import { DriverSettings } from './DriverSettings'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FolderOpen, Package, Clock, Settings, LogOut } from 'lucide-react'

export function DriverView() {
  const [activeTab, setActiveTab] = useState('available')
  const router = useRouter()
  const { currentUser, logout, deliveries } = useApp()

  // Get driver's available and active job counts
  const driverId = currentUser?.driverId || ''
  const availableJobs = deliveries.filter(d => d.status === 'posted')
  const activeJobs = deliveries.filter(
    d => d.driverId === driverId && !['delivered', 'failed_permanent', 'cancelled'].includes(d.status)
  )

  const handleSignOut = () => {
    logout()
    router.push('/login')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const navItems = [
    { id: 'available', label: 'Available', icon: FolderOpen, badge: availableJobs.length },
    { id: 'active', label: 'Active', icon: Package, badge: activeJobs.length > 1 ? activeJobs.length : undefined },
    { id: 'history', label: 'History', icon: Clock },
    { id: 'settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)]">
        <div className="flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--accent-orange)]">DOMS</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 tap-target">
                <span className="text-sm text-foreground hidden sm:block">{currentUser?.name}</span>
                <div className="w-9 h-9 rounded-full bg-[var(--accent-orange)] flex items-center justify-center">
                  <span className="text-sm font-semibold text-white">
                    {getInitials(currentUser?.name || 'D')}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--bg-card)] border-[var(--border-color)]">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground">{currentUser?.name}</p>
                <p className="text-xs text-muted-foreground">Driver</p>
              </div>
              <DropdownMenuSeparator className="bg-[var(--border-color)]" />
              <DropdownMenuItem 
                onClick={handleSignOut}
                className="text-[var(--accent-red)] focus:text-[var(--accent-red)] cursor-pointer"
              >
                <LogOut className="w-4 h-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Content */}
      <main className="px-4 py-4">
        {activeTab === 'available' && (
          <AvailableJobs onJobClaimed={() => setActiveTab('active')} />
        )}
        {activeTab === 'active' && (
          <ActiveDelivery />
        )}
        {activeTab === 'history' && (
          <DriverHistory />
        )}
        {activeTab === 'settings' && (
          <DriverSettings />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNav 
        items={navItems}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  )
}
