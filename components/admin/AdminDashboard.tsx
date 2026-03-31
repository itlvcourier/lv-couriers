'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import { 
  Package, 
  Truck, 
  Building2, 
  CheckCircle,
  Clock,
  TrendingUp
} from 'lucide-react'
import { getDashboardStats, getActivityEvents } from '@/lib/db'

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}

export function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useSWR('dashboard-stats', getDashboardStats, {
    refreshInterval: 30000,
  })
  
  const { data: events, isLoading: eventsLoading } = useSWR('activity-events', () => getActivityEvents(10), {
    refreshInterval: 15000,
  })

  if (statsLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Package className="w-4 h-4" />
              <span className="text-xs">Total Deliveries</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalDeliveries || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Clock className="w-4 h-4 text-blue-500" />
              <span className="text-xs">Active</span>
            </div>
            <p className="text-2xl font-bold text-blue-500">{stats?.activeDeliveries || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-xs">Completed Today</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats?.completedToday || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Truck className="w-4 h-4" />
              <span className="text-xs">Total Drivers</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalDrivers || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="w-4 h-4 text-green-500" />
              <span className="text-xs">Active Drivers</span>
            </div>
            <p className="text-2xl font-bold text-green-500">{stats?.activeDrivers || 0}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-xs">Businesses</span>
            </div>
            <p className="text-2xl font-bold">{stats?.totalBusinesses || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity feed */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle className="text-lg">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {eventsLoading ? (
            <div className="flex justify-center py-8">
              <Spinner className="w-6 h-6" />
            </div>
          ) : events && events.length > 0 ? (
            <div className="space-y-3">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    event.status === 'delivered' ? 'bg-green-500' :
                    event.status === 'failed' ? 'bg-red-500' :
                    event.status === 'in_transit' ? 'bg-blue-500' :
                    event.status === 'claimed' ? 'bg-purple-500' :
                    'bg-yellow-500'
                  }`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{event.action}</span>
                      {event.driver_name && (
                        <span className="text-muted-foreground"> by {event.driver_name}</span>
                      )}
                      {event.business_name && (
                        <span className="text-muted-foreground"> for {event.business_name}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatRelativeTime(event.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
