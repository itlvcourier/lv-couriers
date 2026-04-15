'use client'

import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { 
  Package, 
  Truck, 
  Building2, 
  CheckCircle,
  Clock,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Users,
  Activity
} from 'lucide-react'
import { format, isToday, subHours } from 'date-fns'

export function AdminDashboard() {
  const { orders, drivers, businesses, activityLogs } = useApp()

  // Calculate stats
  const totalOrders = orders.length
  const activeOrders = orders.filter(o => ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status)).length
  const completedToday = orders.filter(o => o.status === 'delivered' && o.deliveredAt && isToday(new Date(o.deliveredAt))).length
  const cancelledOrders = orders.filter(o => o.status === 'cancelled').length
  
  const totalDrivers = drivers.length
  const activeDrivers = drivers.filter(d => d.status === 'available' || d.status === 'busy').length
  const verifiedDrivers = drivers.filter(d => d.isVerified).length
  
  const totalBusinesses = businesses.length
  const activeBusinesses = businesses.filter(b => b.status === 'active').length
  
  const totalRevenue = orders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.price, 0)

  // Recent activity (last 24 hours)
  const recentActivity = activityLogs
    .filter(log => new Date(log.timestamp) > subHours(new Date(), 24))
    .slice(0, 10)

  // Pending orders (need attention)
  const pendingOrders = orders.filter(o => o.status === 'pending').slice(0, 5)

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Orders</p>
                <p className="text-2xl font-bold">{totalOrders}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  <span className="text-success">{completedToday} today</span>
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Package className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Orders</p>
                <p className="text-2xl font-bold text-warning">{activeOrders}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {orders.filter(o => o.status === 'pending').length} pending
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-warning/10 flex items-center justify-center">
                <Clock className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-success/5 border-success/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Active Drivers</p>
                <p className="text-2xl font-bold text-success">{activeDrivers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  of {totalDrivers} total
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-success/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-info/5 border-info/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Revenue</p>
                <p className="text-2xl font-bold text-info">${totalRevenue.toFixed(0)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  all time
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-info/10 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-info" />
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
            <p className="text-lg font-bold text-success">{activeBusinesses}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{verifiedDrivers}</p>
            <p className="text-xs text-muted-foreground">Verified</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold text-destructive">{cancelledOrders}</p>
            <p className="text-xs text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">{orders.filter(o => o.status === 'delivered').length}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 text-center">
            <p className="text-lg font-bold">
              {orders.filter(o => o.status === 'delivered').length > 0 
                ? ((orders.filter(o => o.status === 'delivered').length / totalOrders) * 100).toFixed(0)
                : 0}%
            </p>
            <p className="text-xs text-muted-foreground">Success</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pending Orders */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Pending Orders
              {pendingOrders.length > 0 && (
                <Badge variant="secondary" className="ml-auto">{pendingOrders.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingOrders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No pending orders
              </p>
            ) : (
              <div className="space-y-3">
                {pendingOrders.map((order) => {
                  const business = businesses.find(b => b.id === order.businessId)
                  return (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div>
                        <p className="text-sm font-medium">#{order.id.slice(-6).toUpperCase()}</p>
                        <p className="text-xs text-muted-foreground">{business?.name || 'Unknown'}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="capitalize text-xs">{order.priority}</Badge>
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(order.createdAt), 'h:mm a')}
                        </p>
                      </div>
                    </div>
                  )
                })}
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
                {recentActivity.map((log) => (
                  <div key={log.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${
                      log.action.includes('delivered') ? 'bg-success' :
                      log.action.includes('cancelled') ? 'bg-destructive' :
                      log.action.includes('picked') ? 'bg-info' :
                      log.action.includes('accepted') ? 'bg-primary' :
                      'bg-muted-foreground'
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{log.action}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(log.timestamp), 'h:mm a')}
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
