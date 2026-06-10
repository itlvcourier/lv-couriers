'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { useDriverLocationTracking } from '@/lib/hooks/useDriverLocationTracking'
import { BottomNav } from '@/components/shared/BottomNav'
import { AvailableJobs } from './AvailableJobs'
import { ActiveDelivery } from './ActiveDelivery'
import { DriverHistory } from './DriverHistory'
import { DriverSettings } from './DriverSettings'
import { DriverEarnings } from './DriverEarnings'
import { DriverScanScreen } from './DriverScanScreen'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { useScanSync } from '@/lib/hooks/useScanSync'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FolderOpen, Package, Clock, Settings, LogOut, DollarSign, ScanLine } from 'lucide-react'

export function DriverView() {
  const [activeTab, setActiveTab] = useState('available')
  const router = useRouter()
  const { currentUser, logout, deliveries, settings } = useApp()
  // Show the Scan tab when the operation uses zones/cross-dock or requires scanning.
  const zonesEnabled = useFeatureFlag('zones_enabled')
  const consolidationEnabled = useFeatureFlag('consolidation_enabled')
  const scanningRequired = useFeatureFlag('barcode_scanning_required')
  const showScan = Boolean(zonesEnabled || consolidationEnabled || scanningRequired)
  const { pending: pendingScans } = useScanSync()

  // Get driver's available and active job counts
  const driverId = currentUser?.driverId || ''
  const availableJobs = deliveries.filter(d => d.status === 'posted')
  const activeJobs = deliveries.filter(
    d => d.driverId === driverId && !['delivered', 'failed_permanent', 'cancelled'].includes(d.status)
  )

  // Live-location tracking: while the driver is actively in transit on a job,
  // continuously push GPS to driver_locations so the recipient's tracking page
  // shows a moving dot. Picks the first in-transit delivery as the active one.
  const inTransitDelivery = activeJobs.find(d =>
    ['en_route_pickup', 'picked_up', 'en_route_dropoff'].includes(d.status)
  )
  useDriverLocationTracking({
    driverId,
    deliveryId: inTransitDelivery?.id,
    enabled: Boolean(driverId && inTransitDelivery),
  })

  // When dispatch mode is active, hide the Available tab
  const isDispatchMode = !settings.allowDriverSelfClaim
  
  // Check if driver earnings/pay tracking is enabled
  const showEarnings = settings.driverPayEnabled ?? false

  const handleSignOut = async () => {
    await logout()
    router.push('/login')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  // Conditionally build nav items based on dispatch mode and earnings setting
  const baseNavItems = isDispatchMode
    ? [
        { id: 'active', label: 'My Jobs', icon: Package, badge: activeJobs.length > 0 ? activeJobs.length : undefined },
        ...(showScan ? [{ id: 'scan', label: 'Scan', icon: ScanLine, badge: pendingScans > 0 ? pendingScans : undefined }] : []),
        ...(showEarnings ? [{ id: 'earnings', label: 'Earnings', icon: DollarSign }] : []),
        { id: 'history', label: 'History', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    : [
        { id: 'available', label: 'Available', icon: FolderOpen, badge: availableJobs.length },
        { id: 'active', label: 'Active', icon: Package, badge: activeJobs.length > 1 ? activeJobs.length : undefined },
        ...(showScan ? [{ id: 'scan', label: 'Scan', icon: ScanLine, badge: pendingScans > 0 ? pendingScans : undefined }] : []),
        ...(showEarnings ? [{ id: 'earnings', label: 'Earnings', icon: DollarSign }] : []),
        { id: 'history', label: 'History', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
  
  const navItems = baseNavItems

  // If dispatch mode just turned on and user is on 'available' tab, redirect to 'active'
  if (isDispatchMode && activeTab === 'available') {
    setActiveTab('active')
  }
  
  // If earnings is disabled and user is on 'earnings' tab, redirect to 'history'
  if (!showEarnings && activeTab === 'earnings') {
    setActiveTab('history')
  }

  // If the scan tab is hidden but selected, fall back to a safe tab.
  if (!showScan && activeTab === 'scan') {
    setActiveTab(isDispatchMode ? 'active' : 'available')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)] safe-area-top">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--accent-orange)]">DOMS</span>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 tap-target">
                <span className="text-sm text-foreground hidden sm:block truncate max-w-[120px]">{currentUser?.name}</span>
                <div className="w-9 h-9 rounded-full bg-[var(--accent-orange)] flex items-center justify-center shrink-0">
                  <span className="text-sm font-semibold text-white">
                    {getInitials(currentUser?.name || 'D')}
                  </span>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-[var(--bg-card)] border-[var(--border-color)]">
              <div className="px-3 py-2">
                <p className="text-sm font-medium text-foreground truncate">{currentUser?.name}</p>
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
      <main className="flex-1 px-4 py-4 pb-24 max-w-lg mx-auto w-full overflow-x-hidden">
        {activeTab === 'available' && (
          <AvailableJobs onJobClaimed={() => setActiveTab('active')} />
        )}
        {activeTab === 'active' && (
          <ActiveDelivery />
        )}
        {activeTab === 'scan' && showScan && (
          <DriverScanScreen />
        )}
        {activeTab === 'earnings' && (
          <DriverEarnings />
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
