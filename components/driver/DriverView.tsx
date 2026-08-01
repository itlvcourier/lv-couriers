'use client'

import { useState, useEffect } from 'react'
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
import { DriverTransfersScreen } from './DriverTransfersScreen'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { useScanSync } from '@/lib/hooks/useScanSync'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { FolderOpen, Package, Clock, Settings, LogOut, DollarSign, ScanLine, ArrowLeftRight, RefreshCw } from 'lucide-react'
import { HelpGuide } from '@/components/shared/HelpGuide'

export function DriverView() {
  const [activeTab, setActiveTab] = useState('available')
  const [refreshing, setRefreshing] = useState(false)
  const router = useRouter()
  const { currentUser, logout, deliveries, settings, refreshData } = useApp()

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refreshData()
    } finally {
      setRefreshing(false)
    }
  }
  // Show the Scan tab when the operation uses zones/cross-dock or requires scanning.
  const zonesEnabled = useFeatureFlag('zones_enabled')
  const consolidationEnabled = useFeatureFlag('consolidation_enabled')
  const scanningRequired = useFeatureFlag('barcode_scanning_required')
  const showScan = Boolean(zonesEnabled || consolidationEnabled || scanningRequired)
  const transfersEnabled = useFeatureFlag('driver_transfers_enabled')
  const showTransfers = Boolean(transfersEnabled)
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
  // Respect the driver's location-sharing preference (persisted to localStorage
  // by DriverSettings). Default true so first-run behaviour is unaffected.
  const locationSharingEnabled =
    typeof window !== 'undefined'
      ? localStorage.getItem('driver_location_sharing') !== 'false'
      : true

  useDriverLocationTracking({
    driverId,
    deliveryId: inTransitDelivery?.id,
    enabled: Boolean(driverId && inTransitDelivery && locationSharingEnabled),
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
        ...(showTransfers ? [{ id: 'transfers', label: 'Transfers', icon: ArrowLeftRight }] : []),
        ...(showEarnings ? [{ id: 'earnings', label: 'Earnings', icon: DollarSign }] : []),
        { id: 'history', label: 'History', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
    : [
        { id: 'available', label: 'Available', icon: FolderOpen, badge: availableJobs.length },
        { id: 'active', label: 'Active', icon: Package, badge: activeJobs.length > 1 ? activeJobs.length : undefined },
        ...(showScan ? [{ id: 'scan', label: 'Scan', icon: ScanLine, badge: pendingScans > 0 ? pendingScans : undefined }] : []),
        ...(showTransfers ? [{ id: 'transfers', label: 'Transfers', icon: ArrowLeftRight }] : []),
        ...(showEarnings ? [{ id: 'earnings', label: 'Earnings', icon: DollarSign }] : []),
        { id: 'history', label: 'History', icon: Clock },
        { id: 'settings', label: 'Settings', icon: Settings },
      ]
  
  const navItems = baseNavItems

  // Redirect guards — run in effects to avoid setState during render
  useEffect(() => {
    if (isDispatchMode && activeTab === 'available') {
      setActiveTab('active')
    }
  }, [isDispatchMode, activeTab])

  useEffect(() => {
    if (!showEarnings && activeTab === 'earnings') {
      setActiveTab('history')
    }
  }, [showEarnings, activeTab])

  useEffect(() => {
    if (!showScan && activeTab === 'scan') {
      setActiveTab(isDispatchMode ? 'active' : 'available')
    }
  }, [showScan, activeTab, isDispatchMode])

  useEffect(() => {
    if (!showTransfers && activeTab === 'transfers') {
      setActiveTab(isDispatchMode ? 'active' : 'available')
    }
  }, [showTransfers, activeTab, isDispatchMode])

  return (
    <div className="min-h-screen bg-[var(--bg-primary)] flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[var(--bg-card)] border-b border-[var(--border-color)] safe-area-top">
        <div className="flex items-center justify-between h-14 px-4 max-w-lg mx-auto">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-[var(--accent-orange)]">DOMS</span>
          </div>

          <div className="flex items-center gap-1">
            <HelpGuide role="driver" />
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="Refresh data"
              className="w-9 h-9 rounded-full flex items-center justify-center tap-target text-muted-foreground hover:text-foreground disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

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
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 px-4 py-4 pb-24 max-w-lg mx-auto w-full overflow-x-hidden">
        {activeTab === 'available' && (
          <AvailableJobs onJobClaimed={() => setActiveTab('active')} />
        )}
        {activeTab === 'active' && (
          <ActiveDelivery onNavigateToAvailable={() => setActiveTab('available')} />
        )}
        {activeTab === 'scan' && showScan && (
          <DriverScanScreen />
        )}
        {activeTab === 'transfers' && showTransfers && (
          <DriverTransfersScreen />
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
