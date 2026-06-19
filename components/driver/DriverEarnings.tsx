'use client'

import { useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { useApp } from '@/lib/context'
import { getDriverDeliveries, type DbDelivery } from '@/lib/db'
import { getSystemSettings, calculateDriverPay, getDriverLegEarnings } from '@/lib/settings'
import { getFeatureSettings } from '@/lib/feature-settings'
import { 
  DollarSign, 
  TrendingUp, 
  Package, 
  Calendar,
  Clock,
  Zap,
  Ban,
  ArrowUpRight,
  ArrowDownLeft,
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subDays, isWithinInterval } from 'date-fns'

export function DriverEarnings() {
  const { currentUser, settings: appSettings } = useApp()
  const driverId = currentUser?.driverId || ''

  // Use app context settings for driverPayEnabled check
  const isPayEnabled = appSettings.driverPayEnabled

  // Fetch system settings for pay calculation rates
  const { data: settings, isLoading: settingsLoading } = useSWR('system-settings', getSystemSettings)

  // Fetch driver's deliveries
  const { data: deliveries = [], isLoading: deliveriesLoading } = useSWR(
    driverId ? `driver-earnings-${driverId}` : null,
    () => getDriverDeliveries(driverId),
    { refreshInterval: 60000 }
  )

  // Active pay model (per_order vs per_leg) drives whether we show the leg split.
  const { data: features } = useSWR('feature-settings-pay', getFeatureSettings)
  const payModel = features?.driver_pay_model ?? 'per_order'

  // Authoritative per-leg earnings for the current month (§4 ledger).
  const { data: legEarnings } = useSWR(
    driverId && payModel === 'per_leg' ? `driver-leg-earnings-${driverId}` : null,
    () => {
      const now = new Date()
      return getDriverLegEarnings(driverId, startOfMonth(now), endOfMonth(now))
    },
    { refreshInterval: 60000 },
  )

  const isLoading = settingsLoading || deliveriesLoading

  // Calculate earnings based on settings
  const earnings = useMemo(() => {
    // Use app context setting for enabled check
    if (!isPayEnabled || !settings) {
      return null
    }

    const now = new Date()
    const completedDeliveries = deliveries.filter((d: DbDelivery) => d.status === 'delivered')
    
    // Calculate pay for each delivery using settings
    const deliveriesWithPay = completedDeliveries.map((d: DbDelivery) => ({
      ...d,
      calculatedPay: calculateDriverPay(settings, {
        is_rush: d.is_rush,
        is_urgent: d.is_urgent,
        distance_km: (d as DbDelivery & { distance_km?: number }).distance_km || 5, // Default 5km if not tracked
      })
    }))
    
    // Today
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const todayDeliveries = deliveriesWithPay.filter(d => 
      new Date(d.delivered_at || d.created_at) >= todayStart
    )
    const todayEarnings = todayDeliveries.reduce((sum, d) => sum + d.calculatedPay, 0)
    
    // This week
    const weekStart = startOfWeek(now, { weekStartsOn: 1 })
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 })
    const weekDeliveries = deliveriesWithPay.filter(d => 
      isWithinInterval(new Date(d.delivered_at || d.created_at), { start: weekStart, end: weekEnd })
    )
    const weekEarnings = weekDeliveries.reduce((sum, d) => sum + d.calculatedPay, 0)
    
    // This month
    const monthStart = startOfMonth(now)
    const monthEnd = endOfMonth(now)
    const monthDeliveries = deliveriesWithPay.filter(d => 
      isWithinInterval(new Date(d.delivered_at || d.created_at), { start: monthStart, end: monthEnd })
    )
    const monthEarnings = monthDeliveries.reduce((sum, d) => sum + d.calculatedPay, 0)
    
    // Last 7 days breakdown
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(now, 6 - i)
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)
      const dayDeliveries = deliveriesWithPay.filter(d => 
        isWithinInterval(new Date(d.delivered_at || d.created_at), { start: dayStart, end: dayEnd })
      )
      return {
        date,
        label: format(date, 'EEE'),
        count: dayDeliveries.length,
        earnings: dayDeliveries.reduce((sum, d) => sum + d.calculatedPay, 0),
      }
    })
    
    // Rush/urgent counts
    const rushDeliveries = monthDeliveries.filter(d => d.is_rush)
    const urgentDeliveries = monthDeliveries.filter(d => d.is_urgent)
    
    return {
      today: { count: todayDeliveries.length, amount: todayEarnings },
      week: { count: weekDeliveries.length, amount: weekEarnings },
      month: { count: monthDeliveries.length, amount: monthEarnings },
      last7Days,
      rushCount: rushDeliveries.length,
      urgentCount: urgentDeliveries.length,
      totalDeliveries: completedDeliveries.length,
    }
  }, [deliveries, settings])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Show disabled message if pay system is off
  if (!isPayEnabled) {
    return (
      <div className="p-4 pb-24">
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Earnings Tracking Disabled</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              The automated earnings tracking system is currently not active. 
              Your pay is handled directly by the company. Contact your dispatcher 
              for any questions about compensation.
            </p>
          </CardContent>
        </Card>
        
        {/* Still show delivery stats */}
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)] mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Your Delivery Stats</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Package className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Total Completed Deliveries</span>
              </div>
              <span className="font-semibold">
                {deliveries.filter((d: DbDelivery) => d.status === 'delivered').length}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Calculate max for chart scaling
  const maxEarnings = Math.max(...(earnings?.last7Days.map(d => d.earnings) || [1]), 1)

  return (
    <div className="p-4 space-y-4 pb-24">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-2 sm:p-4 text-center">
            <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-green-500" />
            <p className="text-lg sm:text-2xl font-bold text-green-500">${earnings?.today.amount.toFixed(0) || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Today</p>
            <p className="text-[10px] sm:text-xs text-green-500/70">{earnings?.today.count || 0} del</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-2 sm:p-4 text-center">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-blue-500" />
            <p className="text-lg sm:text-2xl font-bold text-blue-500">${earnings?.week.amount.toFixed(0) || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Week</p>
            <p className="text-[10px] sm:text-xs text-blue-500/70">{earnings?.week.count || 0} del</p>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-2 sm:p-4 text-center">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-1 text-purple-500" />
            <p className="text-lg sm:text-2xl font-bold text-purple-500">${earnings?.month.amount.toFixed(0) || 0}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Month</p>
            <p className="text-[10px] sm:text-xs text-purple-500/70">{earnings?.month.count || 0} del</p>
          </CardContent>
        </Card>
      </div>

      {/* 7-Day Chart */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Last 7 Days</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end justify-between gap-2 h-32">
            {earnings?.last7Days.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-muted-foreground">${day.earnings.toFixed(0)}</span>
                <div 
                  className="w-full bg-primary/20 rounded-t transition-all"
                  style={{ 
                    height: `${Math.max((day.earnings / maxEarnings) * 80, 4)}px`,
                    backgroundColor: day.earnings > 0 ? 'var(--accent-orange)' : 'var(--muted)'
                  }}
                />
                <span className="text-xs text-muted-foreground">{day.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Per-leg breakdown (only meaningful when the company pays per leg) */}
      {payModel === 'per_leg' && legEarnings && (
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">This Month by Leg</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-blue-500" />
                <span className="text-sm">Pickup legs</span>
                <Badge variant="outline" className="text-[10px]">
                  {legEarnings.pickup.jobs}
                </Badge>
              </div>
              <span className="font-semibold">${legEarnings.pickup.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-green-500" />
                <span className="text-sm">Delivery legs</span>
                <Badge variant="outline" className="text-[10px]">
                  {legEarnings.delivery.jobs}
                </Badge>
              </div>
              <span className="font-semibold">${legEarnings.delivery.total.toFixed(2)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
              <span className="text-sm font-medium">Leg pay total</span>
              <span className="font-semibold text-green-500">
                ${legEarnings.total.toFixed(2)}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Pickup-only jobs are included here even after you hand them off at the hub.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Monthly Stats</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">Total Deliveries</span>
            </div>
            <span className="font-semibold">{earnings?.month.count || 0}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-500" />
              <span className="text-sm">Rush Deliveries</span>
            </div>
            <Badge variant="outline" className="bg-orange-500/10 text-orange-500 border-orange-500/30">
              {earnings?.rushCount || 0}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-red-500" />
              <span className="text-sm">Urgent Deliveries</span>
            </div>
            <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
              {earnings?.urgentCount || 0}
            </Badge>
          </div>
          
          <div className="flex items-center justify-between pt-2 border-t border-[var(--border-color)]">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-sm font-medium">Avg per Delivery</span>
            </div>
            <span className="font-semibold text-green-500">
              ${earnings && earnings.month.count > 0 ? (earnings.month.amount / earnings.month.count).toFixed(2) : '0.00'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Lifetime Stats */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">All-Time Deliveries</span>
            <span className="text-lg font-bold">{earnings?.totalDeliveries || 0}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
