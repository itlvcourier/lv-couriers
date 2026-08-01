'use client'

import useSWR from 'swr'
import { useApp } from '@/lib/context'
import { getDriverDeliveries, type DbDelivery } from '@/lib/db'
import { getSystemSettings, calculateDriverPay } from '@/lib/settings'
import { Card, CardContent } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { 
  Calendar, 
  DollarSign, 
  Clock,
  Package,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'

export function DriverHistory() {
  const { currentUser, settings: appSettings } = useApp()
  const driverId = currentUser?.driverId || ''

  // Check if driver pay tracking is enabled
  const showEarnings = appSettings.driverPayEnabled ?? false

  // Fetch full delivery history from DB (not just in-memory context slice)
  const { data: deliveries = [], isLoading: deliveriesLoading } = useSWR(
    driverId ? `driver-history-${driverId}` : null,
    () => getDriverDeliveries(driverId),
    { refreshInterval: 60_000 },
  )

  // Fetch system settings for pay calculation (uses the same source as DriverEarnings)
  const { data: settings, isLoading: settingsLoading } = useSWR(
    'system-settings',
    getSystemSettings,
  )

  const isLoading = deliveriesLoading || (showEarnings && settingsLoading)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  // Get completed/cancelled deliveries sorted newest first
  const historyDeliveries = (deliveries as DbDelivery[])
    .filter(d =>
      d.status === 'delivered' ||
      d.status === 'cancelled' ||
      d.status === 'failed_permanent',
    )
    .sort((a, b) => {
      const aTime = new Date(a.delivered_at || a.cancelled_at || a.updated_at || a.created_at).getTime()
      const bTime = new Date(b.delivered_at || b.cancelled_at || b.updated_at || b.created_at).getTime()
      return bTime - aTime
    })

  if (historyDeliveries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Clock className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No History Yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Your completed and cancelled deliveries will appear here
        </p>
      </div>
    )
  }

  // Calculate stats
  const totalDelivered = historyDeliveries.filter(d => d.status === 'delivered').length
  const totalCancelled = historyDeliveries.filter(d => d.status === 'cancelled').length

  // Use the shared calculateDriverPay from lib/settings (same as DriverEarnings)
  const totalEarnings =
    showEarnings && settings
      ? historyDeliveries
          .filter(d => d.status === 'delivered')
          .reduce(
            (sum, d) =>
              sum +
              calculateDriverPay(settings, {
                is_rush: d.is_rush,
                is_urgent: d.is_urgent,
                distance_km: (d as DbDelivery & { distance_km?: number }).distance_km ?? null,
              }),
            0,
          )
      : 0

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className={`grid gap-2 sm:gap-3 ${showEarnings ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-2 sm:p-4 text-center">
            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-success mx-auto mb-1 sm:mb-2" />
            <p className="text-lg sm:text-2xl font-bold text-success">{totalDelivered}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-2 sm:p-4 text-center">
            <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-destructive mx-auto mb-1 sm:mb-2" />
            <p className="text-lg sm:text-2xl font-bold text-destructive">{totalCancelled}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Cancel</p>
          </CardContent>
        </Card>
        {showEarnings && (
          <Card className="bg-primary/10 border-primary/20">
            <CardContent className="p-2 sm:p-4 text-center">
              <DollarSign className="w-4 h-4 sm:w-5 sm:h-5 text-primary mx-auto mb-1 sm:mb-2" />
              <p className="text-lg sm:text-2xl font-bold text-primary">${totalEarnings.toFixed(0)}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Earned</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* History List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground px-1">
          Delivery History ({historyDeliveries.length})
        </h3>
        {historyDeliveries.map((delivery) => {
          const timestamp = delivery.delivered_at || delivery.cancelled_at || delivery.created_at
          const driverPay =
            showEarnings && settings
              ? calculateDriverPay(settings, {
                  is_rush: delivery.is_rush,
                  is_urgent: delivery.is_urgent,
                  distance_km:
                    (delivery as DbDelivery & { distance_km?: number }).distance_km ?? null,
                })
              : 0

          return (
            <Card key={delivery.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono text-muted-foreground">
                      #{delivery.id.slice(-6).toUpperCase()}
                    </span>
                  </div>
                  <StatusBadge status={delivery.status} />
                </div>

                <div className="space-y-2 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-sm text-foreground line-clamp-1">{delivery.pickup_address}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                    <p className="text-sm text-foreground line-clamp-1">{delivery.dropoff_address}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-border">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="w-3.5 h-3.5" />
                    {format(new Date(timestamp), 'MMM d, yyyy')}
                  </div>
                  {showEarnings && delivery.status === 'delivered' && (
                    <span className="text-sm font-semibold text-primary">
                      ${driverPay.toFixed(2)}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
