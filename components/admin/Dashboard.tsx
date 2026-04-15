'use client'

import { useMemo } from 'react'
import { useApp } from '@/lib/context'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { ActivityFeed } from '@/components/shared/ActivityFeed'
import { LiveDriversMap } from './LiveDriversMap'
import { Package, Truck, CheckCircle2, Users, Clock, AlertCircle } from 'lucide-react'
import { getTimeElapsed, isCompletedStatus } from '@/lib/delivery-utils'
import { cn } from '@/lib/utils'
import type { Delivery } from '@/lib/types'

interface DashboardProps {
  onViewDelivery: (delivery: Delivery) => void
}

export function Dashboard({ onViewDelivery }: DashboardProps) {
  const { deliveries, drivers } = useApp()

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const todayDeliveries = deliveries.filter(d => new Date(d.postedAt) >= today)
    const activeDeliveries = deliveries.filter(d => !isCompletedStatus(d.status) && d.status !== 'posted')
    const completedToday = todayDeliveries.filter(d => d.status === 'delivered')
    const availableDrivers = drivers.filter(d => d.status === 'available')

    return {
      totalToday: todayDeliveries.length,
      activeNow: activeDeliveries.length,
      completedToday: completedToday.length,
      availableDrivers: availableDrivers.length,
    }
  }, [deliveries, drivers])

  // Get active deliveries for the table
  const activeDeliveries = useMemo(() => {
    return deliveries
      .filter(d => !isCompletedStatus(d.status))
      .sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
      .slice(0, 10)
  }, [deliveries])

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <StatCard
          title="Total Today"
          value={stats.totalToday}
          icon={Package}
          iconColor="text-blue-500"
        />
        <StatCard
          title="Active Now"
          value={stats.activeNow}
          icon={Truck}
          iconColor="text-orange-500"
        />
        <StatCard
          title="Completed Today"
          value={stats.completedToday}
          icon={CheckCircle2}
          iconColor="text-green-500"
        />
        <StatCard
          title="Available Drivers"
          value={stats.availableDrivers}
          icon={Users}
          iconColor="text-purple-500"
        />
      </div>

      {/* Live Drivers Map */}
      <LiveDriversMap />

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Deliveries */}
        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2535]">
            <h2 className="font-semibold text-[#e8eaf0]">Active Deliveries</h2>
          </div>
          
          {/* Mobile: Cards */}
          <div className="lg:hidden p-4 space-y-3 max-h-[400px] overflow-y-auto">
            {activeDeliveries.length === 0 ? (
              <p className="text-center text-[#6b7280] py-8">No active deliveries</p>
            ) : (
              activeDeliveries.map(delivery => (
                <button
                  key={delivery.id}
                  onClick={() => onViewDelivery(delivery)}
                  className="w-full bg-[#1a1e2a] rounded-xl p-3 text-left hover:bg-[#1f2535] transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-[#e8eaf0]">{delivery.businessName}</span>
                    <StatusBadge status={delivery.status} />
                  </div>
                  <div className="flex items-center justify-between text-xs text-[#6b7280]">
                    <span>{delivery.driverName || 'Unassigned'}</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {getTimeElapsed(delivery.postedAt)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Desktop: Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1f2535]">
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Job ID</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Business</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Driver</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Elapsed</th>
                </tr>
              </thead>
              <tbody>
                {activeDeliveries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center text-[#6b7280] py-8">
                      No active deliveries
                    </td>
                  </tr>
                ) : (
                  activeDeliveries.map(delivery => (
                    <tr
                      key={delivery.id}
                      onClick={() => onViewDelivery(delivery)}
                      className="border-b border-[#1f2535] hover:bg-[#1a1e2a] cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-[#e8eaf0] font-mono">{delivery.id}</td>
                      <td className="px-4 py-3 text-sm text-[#e8eaf0]">{delivery.businessName}</td>
                      <td className="px-4 py-3 text-sm">
                        {delivery.driverName ? (
                          <span className="text-[#e8eaf0]">{delivery.driverName}</span>
                        ) : (
                          <span className="text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Unassigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={delivery.status} />
                      </td>
                      <td className="px-4 py-3 text-sm text-[#6b7280]">
                        {getTimeElapsed(delivery.postedAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="bg-[#141720] border border-[#1f2535] rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-[#1f2535]">
            <h2 className="font-semibold text-[#e8eaf0]">Live Activity</h2>
          </div>
          <div className="p-4 max-h-[400px] overflow-y-auto">
            <ActivityFeed maxItems={10} />
          </div>
        </div>
      </div>
    </div>
  )
}
