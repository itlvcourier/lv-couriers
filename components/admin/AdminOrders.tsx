'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OrderDetailSheet } from '@/components/shared/OrderDetailSheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  Package, 
  Search,
  Filter,
  Truck,
  Building2,
  Clock,
  ChevronRight,
  MapPin
} from 'lucide-react'
import { format } from 'date-fns'
import type { Order, OrderStatus } from '@/lib/types'

export function AdminOrders() {
  const { orders, drivers, businesses, cancelOrder } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all')
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  // Filter orders
  const filteredOrders = orders.filter(o => {
    const matchesSearch = 
      o.id.toLowerCase().includes(search.toLowerCase()) ||
      o.pickupAddress.toLowerCase().includes(search.toLowerCase()) ||
      o.dropoffAddress.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter
    return matchesSearch && matchesStatus
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getDriver = (driverId?: string) => {
    if (!driverId) return null
    return drivers.find(d => d.id === driverId)
  }

  const getBusiness = (businessId: string) => {
    return businesses.find(b => b.id === businessId)
  }

  const handleCancelOrder = async (orderId: string) => {
    if (confirm('Are you sure you want to cancel this order?')) {
      await cancelOrder(orderId, 'Cancelled by admin')
      setSelectedOrder(null)
    }
  }

  // Stats
  const pendingCount = orders.filter(o => o.status === 'pending').length
  const activeCount = orders.filter(o => ['assigned', 'picked_up', 'in_transit'].includes(o.status)).length
  const completedCount = orders.filter(o => o.status === 'delivered').length
  const cancelledCount = orders.filter(o => o.status === 'cancelled').length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold">Orders</h2>
        <p className="text-sm text-muted-foreground">{orders.length} total orders</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-warning/5 border-warning/20 cursor-pointer" onClick={() => setStatusFilter('pending')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-warning">{pendingCount}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="bg-info/5 border-info/20 cursor-pointer" onClick={() => setStatusFilter('all')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-info">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/20 cursor-pointer" onClick={() => setStatusFilter('delivered')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-success">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/5 border-destructive/20 cursor-pointer" onClick={() => setStatusFilter('cancelled')}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{cancelledCount}</p>
            <p className="text-xs text-muted-foreground">Cancelled</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OrderStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-44">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="assigned">Assigned</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="in_transit">In Transit</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders List */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No orders found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => {
            const driver = getDriver(order.driverId)
            const business = getBusiness(order.businessId)
            
            return (
              <Card 
                key={order.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedOrder(order)}
              >
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    {/* Order Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Package className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-mono">#{order.id.slice(-6).toUpperCase()}</span>
                        <Badge variant="outline" className="capitalize text-xs">{order.priority}</Badge>
                        <StatusBadge status={order.status} />
                      </div>
                      
                      <div className="grid sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{business?.name || 'Unknown Business'}</span>
                        </div>
                        {driver ? (
                          <div className="flex items-center gap-2">
                            <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                            <span className="truncate">{driver.name}</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Clock className="w-4 h-4 shrink-0" />
                            <span>Awaiting driver</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                        <span className="truncate">{order.pickupAddress} → {order.dropoffAddress}</span>
                      </div>
                    </div>

                    {/* Price & Time */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                      <span className="text-lg font-semibold text-primary">${order.price.toFixed(2)}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                      </span>
                      <ChevronRight className="w-5 h-5 text-muted-foreground hidden sm:block" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Order Detail Sheet */}
      <OrderDetailSheet 
        order={selectedOrder}
        driver={selectedOrder?.driverId ? getDriver(selectedOrder.driverId) : undefined}
        business={selectedOrder ? getBusiness(selectedOrder.businessId) : undefined}
        onClose={() => setSelectedOrder(null)}
        onCancel={selectedOrder && ['pending', 'assigned'].includes(selectedOrder.status) 
          ? () => handleCancelOrder(selectedOrder.id) 
          : undefined
        }
        viewType="admin"
      />
    </div>
  )
}
