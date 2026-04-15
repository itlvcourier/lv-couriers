'use client'

import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { 
  MapPin, 
  Calendar, 
  DollarSign, 
  Star,
  Clock,
  Package,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { format } from 'date-fns'

export function DriverHistory() {
  const { orders, currentUser } = useApp()
  
  // Get completed/cancelled orders for this driver
  const historyOrders = orders.filter(
    o => o.driverId === currentUser?.id && 
    (o.status === 'delivered' || o.status === 'cancelled')
  ).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  if (historyOrders.length === 0) {
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
  const totalDelivered = historyOrders.filter(o => o.status === 'delivered').length
  const totalCancelled = historyOrders.filter(o => o.status === 'cancelled').length
  const totalEarnings = historyOrders
    .filter(o => o.status === 'delivered')
    .reduce((sum, o) => sum + o.price, 0)

  return (
    <div className="space-y-6">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-4 text-center">
            <CheckCircle className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold text-success">{totalDelivered}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-4 text-center">
            <XCircle className="w-5 h-5 text-destructive mx-auto mb-2" />
            <p className="text-2xl font-bold text-destructive">{totalCancelled}</p>
            <p className="text-xs text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold text-primary">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* History List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground px-1">Recent Deliveries</h3>
        {historyOrders.map((order) => (
          <Card key={order.id} className="overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-mono text-muted-foreground">
                    #{order.id.slice(-6).toUpperCase()}
                  </span>
                </div>
                <StatusBadge status={order.status} />
              </div>

              <div className="space-y-2 mb-3">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <p className="text-sm text-foreground line-clamp-1">{order.pickupAddress}</p>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                  <p className="text-sm text-foreground line-clamp-1">{order.dropoffAddress}</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-3 border-t border-border">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  {format(new Date(order.updatedAt), 'MMM d, yyyy')}
                </div>
                <div className="flex items-center gap-3">
                  {order.status === 'delivered' && order.rating && (
                    <div className="flex items-center gap-1">
                      <Star className="w-3.5 h-3.5 text-warning fill-warning" />
                      <span className="text-sm font-medium">{order.rating}</span>
                    </div>
                  )}
                  <span className="text-sm font-semibold text-primary">
                    ${order.price.toFixed(2)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
