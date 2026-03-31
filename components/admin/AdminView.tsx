'use client'

import { useState } from 'react'
import { AdminSidebar, AdminBottomNav, type AdminPage } from '@/components/shared/AdminSidebar'
import { DeliveryDetailPanel } from '@/components/shared/DeliveryDetailPanel'
import { Dashboard } from './Dashboard'
import { ActiveDeliveries } from './ActiveDeliveries'
import { AllDeliveries } from './AllDeliveries'
import { Drivers } from './Drivers'
import { Businesses } from './Businesses'
import { PostJob } from './PostJob'
import type { Delivery } from '@/lib/types'
import { Truck } from 'lucide-react'

export function AdminView() {
  const [activePage, setActivePage] = useState<AdminPage>('dashboard')
  const [selectedDelivery, setSelectedDelivery] = useState<Delivery | null>(null)
  const [driverFilter, setDriverFilter] = useState<string>('all')
  const [businessFilter, setBusinessFilter] = useState<string>('all')

  const handleViewDelivery = (delivery: Delivery) => {
    setSelectedDelivery(delivery)
  }

  const handleViewDriverHistory = (driverId: string) => {
    setDriverFilter(driverId)
    setBusinessFilter('all')
    setActivePage('all')
  }

  const handleViewBusinessDeliveries = (businessId: string) => {
    setBusinessFilter(businessId)
    setDriverFilter('all')
    setActivePage('all')
  }

  const handlePageChange = (page: AdminPage) => {
    setActivePage(page)
    // Reset filters when changing pages
    if (page !== 'all') {
      setDriverFilter('all')
      setBusinessFilter('all')
    }
  }

  return (
    <div className="flex min-h-screen bg-[#0d0f14]">
      {/* Sidebar (desktop) */}
      <AdminSidebar activePage={activePage} onPageChange={handlePageChange} />

      {/* Main content */}
      <main className="flex-1 lg:ml-60 pb-20 lg:pb-0">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 h-16 bg-[#141720] border-b border-[#1f2535]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <Truck className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-[#e8eaf0]">DOMS Admin</span>
          </div>
        </header>

        {/* Page content */}
        {activePage === 'dashboard' && <Dashboard onViewDelivery={handleViewDelivery} />}
        {activePage === 'active' && <ActiveDeliveries onViewDelivery={handleViewDelivery} />}
        {activePage === 'all' && (
          <AllDeliveries
            onViewDelivery={handleViewDelivery}
            initialDriverFilter={driverFilter}
            initialBusinessFilter={businessFilter}
          />
        )}
        {activePage === 'drivers' && <Drivers onViewDriverHistory={handleViewDriverHistory} />}
        {activePage === 'businesses' && <Businesses onViewBusinessDeliveries={handleViewBusinessDeliveries} />}
        {activePage === 'post' && <PostJob />}
      </main>

      {/* Bottom navigation (mobile) */}
      <AdminBottomNav activePage={activePage} onPageChange={handlePageChange} />

      {/* Delivery detail panel */}
      <DeliveryDetailPanel
        delivery={selectedDelivery}
        open={!!selectedDelivery}
        onClose={() => setSelectedDelivery(null)}
      />
    </div>
  )
}
