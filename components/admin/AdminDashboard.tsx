'use client'

import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Package, 
  Truck, 
  Building2, 
  CheckCircle,
  Clock,
  DollarSign,
  AlertTriangle,
  Activity,
  Zap,
  Phone,
  RefreshCw,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

export function AdminDashboard() {
  const { 
    deliveries, 
    drivers, 
    businesses, 
    activityFeed, 
    timeoutWarnings, 
    dismissTimeout,
    reassignDriver,
  } = useApp()

  // Calculate stats
  const totalDeliveries = deliveries.length
  const activeDeliveries = deliveries.filter(d => 
    !['delivered', 'failed_permanent', 'cancelled'].includes(d.status)
  ).length
  const completedToday = deliveries.filter(d => {
    if (!d.deliveredAt) return false
    const delivered = new Date(d.deliveredAt)
    const today = new Date()
    return delivered.toDateString() === today.toDateString()
  }).length
  const postedDeliveries = deliveries.filter(d => d.status === 'posted').length
  
  const totalDrivers = drivers.length
  const activeDrivers = drivers.filter(d => d.status === 'available' || d.status === 'on_delivery').length
  
  const totalBusinesses = businesses.length
  
  const totalRevenue = deliveries
    .filter(d => d.status === 'delivered' && d.calculatedRate)
    .reduce((sum, d) => sum + (d.calculatedRate || 0), 0)
  
  // Unclaimed rush jobs
  const unclaimedRush = deliveries.filter(d => d.status === 'posted' && d.isUrgent)
  
  // Active timeout warnings (not dismissed)
  const activeTimeouts = timeoutWarnings.filter(t => !t.dismissed)
  
  // Recent activity (last 8 items)
  const recentActivity = activityFeed.slice(0, 8)
  
  // Posted deliveries awaiting claim
  const pendingDeliveries = deliveries.filter(d => d.status === 'posted').slice(0, 5)

  const handleCallDriver = (phone: string, name: string) => {
    toast.info(`Call ${name}: ${phone}`)
  }
  
  const availableDrivers = drivers.filter(d => d.status === 'available' && d.inviteStatus === 'active')

  return (
    <div className="space-y-6">
      {/* Timeout Warnings Section */}
      {activeTimeouts.length > 0 && (
        <Card className="border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-yellow-400">
              <Clock className="w-4 h-4" />
              Timeout Warnings ({activeTimeouts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeTimeouts.map((warning) => (
                <div key={warning.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card)]">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">
                      {warning.driverName} - #{warning.deliveryId.split('-')[1]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {warning.businessName} - {warning.lastUpdateMinutes}m since last update
                    </p>
                    <Badge variant="outline" className="mt-1 text-xs capitalize">
                      {warning.timeoutType.replace('_', ' ')}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const driver = drivers.find(d => d.id === warning.driverId)
                        if (driver) handleCallDriver(driver.phone, driver.name)
                      }}
                      className="h-8"
                    >
                      <Phone className="w-3 h-3 mr-1" />
                      Call
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toast.info('Select a driver to reassign')}
                      className="h-8"
                    >
                      <RefreshCw className="w-3 h-3 mr-1" />
                      Reassign
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        dismissTimeout(warning.id)
                        toast.success('Warning dismissed')
                      }}
                      className="h-8"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Unclaimed Rush Jobs Warning */}
      {unclaimedRush.length > 0 && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2 text-red-400">
              <Zap className="w-4 h-4" />
              Unclaimed Rush Jobs ({unclaimedRush.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {unclaimedRush.map((delivery) => {
                // Calculate time since posted
                const posted = new Date(delivery.postedAt)
                const now = new Date()
                const minsAgo = Math.floor((now.getTime() - posted.getTime()) / 60000)
                const slaMins = 45
                const remaining = slaMins - minsAgo
                const breached = remaining <= 0
                
                return (
                  <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card)]">
                    <div>
                      <p className="text-sm font-medium text-foreground">{delivery.businessName}</p>
                      <p className="text-xs text-muted-foreground">
                        {delivery.pickupArea} → {delivery.dropoffArea}
                      </p>
                    </div>
                    <div className="text-right">
                      {breached ? (
                        <Badge variant="destructive" className="animate-pulse">
                          SLA BREACHED - {Math.abs(remaining)}m ago
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={remaining < 15 ? 'text-red-400 border-red-400' : 'text-orange-400 border-orange-400'}>
                          {remaining}m remaining
                        </Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Deliveries</p>
                <p className="text-2xl font-bold">{totalDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-green-400">{completedToday} today</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active</p>
                <p className="text-2xl font-bold text-yellow-400">{activeDeliveries}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {postedDeliveries} awaiting claim
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-yellow-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-green-500/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Drivers</p>
                <p className="text-2xl font-bold text-green-400">{activeDrivers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {totalDrivers} total
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-green-500/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-green-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Revenue</p>
                <p className="text-2xl font-bold text-blue-400">${totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  all time
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{totalBusinesses}</p>
            <p className="text-xs text-muted-foreground">Businesses</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-green-400">{businesses.filter(b => b.inviteStatus === 'active').length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{drivers.filter(d => d.inviteStatus === 'active').length}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-red-400">{deliveries.filter(d => d.status === 'failed_permanent').length}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{deliveries.filter(d => d.status === 'delivered').length}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">
              {deliveries.filter(d => d.status === 'delivered').length > 0 
                ? ((deliveries.filter(d => d.status === 'delivered').length / totalDeliveries) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Success</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending Deliveries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-400" />
              Awaiting Claim
              {pendingDeliveries.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{pendingDeliveries.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingDeliveries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No pending deliveries
              </p>
            ) : (
              <div className="space-y-3">
                {pendingDeliveries.map((delivery) => (
                  <div key={delivery.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-sm font-medium">{delivery.businessName}</p>
                      <p className="text-xs text-muted-foreground">{delivery.pickupArea} → {delivery.dropoffArea}</p>
                    </div>
                    <div className="text-right">
                      {delivery.isUrgent && (
                        <Badge variant="destructive" className="text-xs mb-1">Rush</Badge>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(delivery.postedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No recent activity
              </p>
            ) : (
              <div className="space-y-3">
                {recentActivity.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      item.type === 'status_change' ? 'bg-green-400' :
                      item.type === 'sms_sent' ? 'bg-blue-400' :
                      item.type === 'battery_warning' ? 'bg-yellow-400' :
                      item.type === 'timeout_warning' ? 'bg-red-400' :
                      item.type === 'email_bounced' ? 'bg-red-400' :
                      'bg-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{item.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
