'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { OrderDetailSheet } from '@/components/shared/OrderDetailSheet'
import {
  Package,
  Clock,
  ChevronRight,
  Truck,
  UserRound,
  XCircle,
  AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OrderLike } from '@/components/shared/OrderDetailSheet'
import type { Delivery } from '@/lib/types'
import { estimateDeliveryPrice } from '@/lib/billing'

export function BusinessOrders() {
  const { deliveries, currentUser, drivers, cancelOrderByBusiness, getRateCardForLocation, activeLocationId } = useApp()
  const [selectedOrder, setSelectedOrder] = useState<OrderLike | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  // Filter by business AND location (if a specific location is selected)
  const businessDeliveries = (deliveries || []).filter(d => {
    if (d.businessId !== currentUser?.businessId) return false
    // If "all" locations selected or no location filter, show all business deliveries
    if (!activeLocationId || activeLocationId === 'all') return true
    // Otherwise filter by specific location
    return d.locationId === activeLocationId
  })

  // Keep a map from OrderLike.id -> full Delivery so detail/cancel handlers
  // can access the richer data without extra lookups.
  const businessOrders: OrderLike[] = businessDeliveries
    .map(d => {
      // Authoritative price (from pickup verification) falls back to a live
      // rate-card estimate, then 0 if no rate card is set (UI flags this).
      const price = estimateDeliveryPrice(d, getRateCardForLocation(d.locationId))
      return {
      id: d.id,
      businessId: d.businessId,
      businessName: d.businessName,
      driverId: d.driverId,
      status: d.status,
      priority: d.isUrgent ? 'urgent' : d.isRush ? 'rush' : 'standard',
      pickupAddress: d.pickupAddress,
      dropoffAddress: d.dropoffAddress,
      price,
      createdAt: d.postedAt,
      pickedUpAt: d.pickedUpAt || undefined,
      deliveredAt: d.deliveredAt || undefined,
      recipientName: d.recipientName || null,
      recipientPhone: d.recipientPhone || null,
      buzzCode: d.buzzCode || null,
      cancellationReason: d.cancellationReason || null,
      dropoffContact: d.recipientPhone || undefined,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getDelivery = (id: string) => businessDeliveries.find(d => d.id === id)

  const activeOrders = businessOrders.filter(o =>
    ['posted', 'claimed', 'en_route_pickup', 'picked_up', 'en_route_dropoff'].includes(
      o.status,
    ),
  )
  const completedOrders = businessOrders.filter(o =>
    ['delivered', 'cancelled', 'failed_permanent'].includes(o.status),
  )

  const filteredOrders =
    filter === 'all'
      ? businessOrders
      : filter === 'active'
        ? activeOrders
        : completedOrders

  const getDriver = (driverId?: string | null) => {
    if (!driverId) return null
    return drivers.find(d => d.id === driverId)
  }

  const openCancelDialog = (delivery: Delivery) => {
    setCancelTarget(delivery)
    setCancelReason('')
  }

  const confirmCancel = async () => {
    if (!cancelTarget) return
    setCancelling(true)
    const result = cancelOrderByBusiness(cancelTarget.id, cancelReason)
    setCancelling(false)

    if (!result.ok) {
      toast.error(result.error || 'Could not cancel order')
      return
    }

    toast.success('Order cancelled', {
      description: 'No cancellation fee — driver hadn\u2019t claimed yet.',
    })
    setCancelTarget(null)
    setCancelReason('')
    // If the detail sheet was open on this order, close it
    if (selectedOrder?.id === cancelTarget.id) setSelectedOrder(null)
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
            <p className="text-2xl font-bold text-success">
              {completedOrders.filter(o => o.status === 'delivered').length}
            </p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
        <TabsList className="w-full">
          <TabsTrigger value="all" className="flex-1">
            All ({businessOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="flex-1">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="completed" className="flex-1">
            Done ({completedOrders.length})
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Orders List */}
      <div className="space-y-3">
        {filteredOrders.map(order => {
          const driver = getDriver(order.driverId)
          const delivery = getDelivery(order.id)
          const canCancel = order.status === 'posted' && !order.driverId

          return (
            <Card
              key={order.id}
              className="overflow-hidden cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedOrder(order)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3 gap-2">
                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <Package className="w-4 h-4 text-muted-foreground shrink-0" />
                    <span className="text-sm font-mono text-muted-foreground">
                      #{order.id.slice(-6).toUpperCase()}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                      {order.priority}
                    </Badge>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* Recipient line */}
                {delivery?.recipientName && (
                  <div className="flex items-center gap-1.5 text-sm text-foreground mb-2">
                    <UserRound className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span className="truncate">{delivery.recipientName}</span>
                    {delivery.buzzCode && (
                      <Badge variant="outline" className="h-5 text-xs font-normal">
                        Buzz {delivery.buzzCode}
                      </Badge>
                    )}
                  </div>
                )}

                <div className="space-y-2 mb-3">
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <p className="text-sm text-foreground line-clamp-1">
                      {order.pickupAddress}
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 rounded-full bg-success mt-1.5 shrink-0" />
                    <p className="text-sm text-foreground line-clamp-1">
                      {order.dropoffAddress}
                    </p>
                  </div>
                </div>

                {/* Cancellation info for cancelled orders */}
                {order.status === 'cancelled' && delivery?.cancellationReason && (
                  <div className="mb-3 rounded-md bg-destructive/5 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                    <span className="font-medium">Cancelled:</span>{' '}
                    {delivery.cancellationReason}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-border gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {driver ? (
                      <div className="flex items-center gap-2 min-w-0">
                        <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="text-sm text-muted-foreground truncate">
                          {driver.name}
                        </span>
                      </div>
                    ) : order.status === 'posted' ? (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="w-3.5 h-3.5" />
                        Awaiting driver
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {canCancel && delivery && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                        onClick={e => {
                          e.stopPropagation()
                          openCancelDialog(delivery)
                        }}
                      >
                        <XCircle className="w-3.5 h-3.5 mr-1" />
                        Cancel
                      </Button>
                    )}
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
        onCancel={
          selectedOrder?.status === 'posted' && !selectedOrder.driverId
            ? () => {
                const d = getDelivery(selectedOrder.id)
                if (d) openCancelDialog(d)
              }
            : undefined
        }
        viewType="business"
      />

      {/* Cancel confirmation dialog */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={open => {
          if (!open) {
            setCancelTarget(null)
            setCancelReason('')
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Cancel this order?
            </DialogTitle>
            <DialogDescription>
              This is free because no driver has claimed it yet. Once claimed, cancellation
              may incur a fee — contact dispatch for those cases.
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && (
            <div className="space-y-4">
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-3 space-y-1.5">
                  <p className="text-xs font-mono text-muted-foreground">
                    #{cancelTarget.id.slice(-6).toUpperCase()}
                  </p>
                  {cancelTarget.recipientName && (
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                      {cancelTarget.recipientName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    To: {cancelTarget.dropoffAddress}
                  </p>
                </CardContent>
              </Card>

              <div className="space-y-2">
                <Label htmlFor="cancel-reason" className="text-sm">
                  Reason{' '}
                  <span className="text-xs text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={e => setCancelReason(e.target.value)}
                  placeholder="e.g. Customer changed their mind, posted by mistake, recipient unavailable..."
                  rows={3}
                  maxLength={200}
                  className="resize-none"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null)
                setCancelReason('')
              }}
              disabled={cancelling}
            >
              Keep Order
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancel}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
