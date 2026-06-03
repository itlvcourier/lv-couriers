'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
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
  Pencil,
  Copy,
} from 'lucide-react'
import { toast } from 'sonner'
import type { OrderLike } from '@/components/shared/OrderDetailSheet'
import type { Delivery } from '@/lib/types'
import { estimateDeliveryPrice } from '@/lib/billing'
import { editDeliveryDetails } from '@/lib/db'

export function BusinessOrders() {
  const { deliveries, currentUser, drivers, cancelOrderByBusiness, getRateCardForLocation, activeLocationId } = useApp()
  const [selectedOrder, setSelectedOrder] = useState<OrderLike | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all')
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  
  // Edit state
  const [editTarget, setEditTarget] = useState<Delivery | null>(null)
  const [editForm, setEditForm] = useState({
    dropoff_address: '',
    recipient_name: '',
    recipient_phone: '',
    buzz_code: '',
    special_instructions: '',
    is_rush: false,
    is_urgent: false,
  })
  const [saving, setSaving] = useState(false)
  
  // Duplicate state
  const [duplicateTarget, setDuplicateTarget] = useState<Delivery | null>(null)

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
      proofPhotoUrl: d.proofPhotoUrl || null,
      pickupPhotoUrl: d.pickupPhotoUrl || null,
      signatureUrl: d.signatureUrl || null,
      recipientNote: d.recipientNote || null,
      }
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const getDelivery = (id: string) => businessDeliveries.find(d => d.id === id)

  const activeOrders = businessOrders.filter(o =>
    ['posted', 'claimed', 'en_route_pickup', 'picked_up', 'en_route_dropoff'].includes(
      o.status,
    ),
  )
  const deliveredOrders = businessOrders.filter(o => o.status === 'delivered')
  const cancelledOrders = businessOrders.filter(o =>
    ['cancelled', 'failed_permanent'].includes(o.status),
  )

  const filteredOrders =
    filter === 'all'
      ? businessOrders
      : filter === 'active'
        ? activeOrders
        : filter === 'delivered'
          ? deliveredOrders
          : cancelledOrders

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

  // Edit handlers
  const openEditDialog = (delivery: Delivery) => {
    setEditForm({
      dropoff_address: delivery.dropoffAddress,
      recipient_name: delivery.recipientName || '',
      recipient_phone: delivery.recipientPhone || '',
      buzz_code: delivery.buzzCode || '',
      special_instructions: delivery.recipientNote || '',
      is_rush: delivery.isRush || false,
      is_urgent: delivery.isUrgent || false,
    })
    setEditTarget(delivery)
  }

  const confirmEdit = async () => {
    if (!editTarget) return
    setSaving(true)
    
    try {
      await editDeliveryDetails(editTarget.id, {
        dropoff_address: editForm.dropoff_address,
        recipient_name: editForm.recipient_name || undefined,
        recipient_phone: editForm.recipient_phone || undefined,
        buzz_code: editForm.buzz_code || undefined,
        special_instructions: editForm.special_instructions || undefined,
        is_rush: editForm.is_rush,
        is_urgent: editForm.is_urgent,
      })
      
      toast.success('Delivery updated successfully')
      setEditTarget(null)
      // Page will reload/re-fetch data on next render cycle
      window.location.reload()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update delivery')
    } finally {
      setSaving(false)
    }
  }

  // Duplicate handler - opens create order with pre-filled data
  const openDuplicateDialog = (delivery: Delivery) => {
    setDuplicateTarget(delivery)
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
    <div className="space-y-4 overflow-x-hidden">
      {/* Stats Summary */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="bg-primary/10 border-primary/20">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-bold text-primary">{businessOrders.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/10 border-warning/20">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-bold text-warning">{activeOrders.length}</p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card className="bg-success/10 border-success/20">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-bold text-success">
              {deliveredOrders.length}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Done</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/20">
          <CardContent className="p-2 sm:p-3 text-center">
            <p className="text-lg sm:text-2xl font-bold text-destructive">
              {cancelledOrders.length}
            </p>
            <p className="text-[10px] sm:text-xs text-muted-foreground">Cancel</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Tabs */}
      <Tabs value={filter} onValueChange={v => setFilter(v as typeof filter)}>
        <TabsList className="w-full h-auto grid grid-cols-4">
          <TabsTrigger value="all" className="text-[10px] sm:text-sm px-1 sm:px-3">
            All ({businessOrders.length})
          </TabsTrigger>
          <TabsTrigger value="active" className="text-[10px] sm:text-sm px-1 sm:px-3">
            Active ({activeOrders.length})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="text-[10px] sm:text-sm px-1 sm:px-3">
            Done ({deliveredOrders.length})
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="text-[10px] sm:text-sm px-1 sm:px-3">
            Cancel ({cancelledOrders.length})
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

                <div className="pt-3 border-t border-border space-y-2">
                  {/* Driver info row */}
                  <div className="flex items-center justify-between">
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-primary">
                        ${order.price.toFixed(2)}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                  {/* Action buttons row */}
                  {(canCancel || (delivery && order.status !== 'posted')) && (
                    <div className="flex items-center gap-2">
                      {canCancel && delivery && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2"
                            onClick={e => {
                              e.stopPropagation()
                              openEditDialog(delivery)
                            }}
                          >
                            <Pencil className="w-3 h-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs px-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            onClick={e => {
                              e.stopPropagation()
                              openCancelDialog(delivery)
                            }}
                          >
                            <XCircle className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {delivery && order.status !== 'posted' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs px-2"
                          onClick={e => {
                            e.stopPropagation()
                            openDuplicateDialog(delivery)
                          }}
                        >
                          <Copy className="w-3 h-3 mr-1" />
                          Reorder
                        </Button>
                      )}
                    </div>
                  )}
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

      {/* Edit Delivery Sheet */}
      <Sheet open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Delivery</SheetTitle>
            <SheetDescription>
              Update delivery details. Only available before a driver claims the order.
            </SheetDescription>
          </SheetHeader>
          
          {editTarget && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Dropoff Address</Label>
                <Textarea
                  value={editForm.dropoff_address}
                  onChange={(e) => setEditForm({ ...editForm, dropoff_address: e.target.value })}
                  placeholder="Enter dropoff address"
                  rows={2}
                />
              </div>
              
              <div className="space-y-2">
                <Label>Recipient Name</Label>
                <Input
                  value={editForm.recipient_name}
                  onChange={(e) => setEditForm({ ...editForm, recipient_name: e.target.value })}
                  placeholder="Recipient name"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Recipient Phone</Label>
                  <Input
                    value={editForm.recipient_phone}
                    onChange={(e) => setEditForm({ ...editForm, recipient_phone: e.target.value })}
                    placeholder="Phone number"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Buzz Code</Label>
                  <Input
                    value={editForm.buzz_code}
                    onChange={(e) => setEditForm({ ...editForm, buzz_code: e.target.value })}
                    placeholder="Buzz code"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Special Instructions</Label>
                <Textarea
                  value={editForm.special_instructions}
                  onChange={(e) => setEditForm({ ...editForm, special_instructions: e.target.value })}
                  placeholder="Any special instructions for the driver"
                  rows={3}
                />
              </div>
              
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Rush Delivery</Label>
                    <p className="text-xs text-muted-foreground">Higher priority, faster delivery</p>
                  </div>
                  <Switch
                    checked={editForm.is_rush}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_rush: checked, is_urgent: checked ? false : editForm.is_urgent })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Urgent Delivery</Label>
                    <p className="text-xs text-muted-foreground">Highest priority, immediate dispatch</p>
                  </div>
                  <Switch
                    checked={editForm.is_urgent}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_urgent: checked, is_rush: checked ? false : editForm.is_rush })}
                  />
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button variant="outline" className="flex-1" onClick={() => setEditTarget(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button className="flex-1" onClick={confirmEdit} disabled={saving}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Duplicate/Reorder Confirmation */}
      <Dialog open={!!duplicateTarget} onOpenChange={(open) => !open && setDuplicateTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="w-5 h-5 text-primary" />
              Reorder Delivery
            </DialogTitle>
            <DialogDescription>
              Create a new delivery with the same details as this order.
            </DialogDescription>
          </DialogHeader>
          
          {duplicateTarget && (
            <div className="space-y-4">
              <Card className="bg-muted/40 border-border">
                <CardContent className="p-3 space-y-1.5">
                  {duplicateTarget.recipientName && (
                    <p className="text-sm font-medium flex items-center gap-1.5">
                      <UserRound className="w-3.5 h-3.5 text-muted-foreground" />
                      {duplicateTarget.recipientName}
                    </p>
                  )}
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    From: {duplicateTarget.pickupAddress}
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    To: {duplicateTarget.dropoffAddress}
                  </p>
                </CardContent>
              </Card>
              
              <p className="text-sm text-muted-foreground">
                This will open the new order form with all details pre-filled. You can review and modify before posting.
              </p>
            </div>
          )}
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDuplicateTarget(null)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                // Store duplicate data and navigate to create order
                if (duplicateTarget) {
                  sessionStorage.setItem('duplicateOrder', JSON.stringify({
                    pickupAddress: duplicateTarget.pickupAddress,
                    dropoffAddress: duplicateTarget.dropoffAddress,
                    recipientName: duplicateTarget.recipientName,
                    recipientPhone: duplicateTarget.recipientPhone,
                    buzzCode: duplicateTarget.buzzCode,
                    specialInstructions: duplicateTarget.recipientNote,
                    isRush: duplicateTarget.isRush,
                    isUrgent: duplicateTarget.isUrgent,
                  }))
                  toast.success('Order details copied! Go to New Order to complete.')
                  setDuplicateTarget(null)
                }
              }}
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy & Create New
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
