'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OrderDetailSheet } from '@/components/shared/OrderDetailSheet'
import { 
  Package, 
  Clock,
  MapPin,
  Phone,
  ChevronRight,
  Truck,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react'
import { format } from 'date-fns'
import type { Order } from '@/lib/types'

export function BusinessOrders() {
  const { deliveries, currentUser, drivers } = useApp()
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  
  // Get orders for this business - convert deliveries to orders format
  const businessOrders = (deliveries || [])
    .filter(d => d.businessId === currentUser?.id)
    .map(d => ({
      id: d.id,
      businessId: d.businessId,
      businessName: d.businessName,
      driverId: d.driverId,
      status: d.status as Order['status'],
      priority: d.isUrgent ? 'urgent' as const : 'standard' as const,
      pickupAddress: d.pickupAddress,
      dropoffAddress: d.dropoffAddress,
      price: d.calculatedRate || 15,
      createdAt: d.postedAt,
    } as Order))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const activeOrders = businessOrders.filter(o => 
    ['pending', 'assigned', 'picked_up', 'in_transit'].includes(o.status)
  )
  const completedOrders = businessOrders.filter(o => 
    ['delivered', 'cancelled'].includes(o.status)
  )

  const filteredOrders = filter === 'all' 
    ? businessOrders 
    : filter === 'active' 
      ? activeOrders 
      : completedOrders

  const getDriver = (driverId?: string) => {
    if (!driverId) return null
    return drivers.find(d => d.id === driverId)
  }

  const handleCancelOrder = async (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      // Note: cancelOrder will be added in future when needed
      setSelectedOrder(null)
    }
  }

  if (businessOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
          <Package className="w-10 h-10 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Orders Yet</h3>
        <p className="text-sm text-muted-foreground text-center max-w-xs">
          Create your first delivery order to get started
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{businessOrders.length}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{activeOrders.length}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{completedOrders.filter(o => o.status === 'delivered').length}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">All ({businessOrders.length})</TabsTrigger>
          <TabsTrigger value="active" className="flex-1">Active ({activeOrders.length})</TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">Done ({completedOrders.length})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.map((order) => {
          const driver = getDriver(order.driverId)
          
          return (
            <Card 
              key={order.id} 
              className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-mono text-muted-foreground">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {order.priority}
                    </Badge>
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
                  <div className="flex items-center gap-2">
                    {driver ? (
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-muted-foreground">{driver.name}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Awaiting driver
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-primary">
                      ${order.price.toFixed(2)}
                    </span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Order Detail Sheet */}
      <OrderDetailSheet 
        order={selectedOrder}
        driver={selectedOrder?.driverId ? getDriver(selectedOrder.driverId) : undefined}
        onClose={() => setSelectedOrder(null)}
        onCancel={selectedOrder?.status === 'pending' ? () => handleCancelOrder(selectedOrder.id) : undefined}
        viewType="business"
      />
    </div>
  )
}
