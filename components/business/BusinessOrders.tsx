'use client'

import { useState, useMemo } from 'react'
import { ListPager, paginate } from '@/components/shared/ListPager'

const ORDER_PAGE_SIZE = 20
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Search } from 'lucide-react'
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
import { EditDeliverySheet } from './EditDeliverySheet'
import { LabelPrintButton } from '@/components/shared/LabelPrintButton'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RouteTrack } from './RouteTrack'
import { NeedsAttention } from './NeedsAttention'

const orderTimeFormatter = new Intl.DateTimeFormat('en-CA', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

interface BusinessOrdersProps {
  onNavigate?: (tab: string) => void
}

export function BusinessOrders({ onNavigate }: BusinessOrdersProps) {
  const { deliveries, currentUser, drivers, cancelOrderByBusiness, patchDelivery, getRateCardForLocation, activeLocationId } = useApp()
  const [selectedOrder, setSelectedOrder] = useState<OrderLike | null>(null)
  const [filter, setFilter] = useState<'all' | 'active' | 'delivered' | 'cancelled'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [cancelTarget, setCancelTarget] = useState<Delivery | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [cancelling, setCancelling] = useState(false)
  
  // Edit state
  const [editTarget, setEditTarget] = useState<Delivery | null>(null)
  
  // Duplicate state
  const [duplicateTarget, setDuplicateTarget] = useState<Delivery | null>(null)

  // §11: optimistic "label printed" tracking so the indicator flips instantly
  // after printing, without waiting for a full data refresh.
  const [printedIds, setPrintedIds] = useState<Set<string>>(new Set())
  const markPrinted = (ids: string[]) =>
    setPrintedIds((prev) => new Set([...prev, ...ids]))

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
      proofPhotoUrls: d.proofPhotoUrls || null,
      pickupPhotoUrl: d.pickupPhotoUrl || null,
      signatureUrl: d.signatureUrl || null,
      recipientNote: d.recipientNote || null,
      handoff: {
        handoffRule: d.handoffRule ?? null,
        handoffRequireId: d.handoffRequireId ?? false,
        handoffNamedPerson: d.handoffNamedPerson ?? null,
        handoffNamedRelationship: d.handoffNamedRelationship ?? null,
        handoffLocationNote: d.handoffLocationNote ?? null,
        receivedByType: d.receivedByType ?? null,
        receivedByName: d.receivedByName ?? null,
                    receivedByRelationship: d.receivedByRelationship ?? null,
                    receivedByIdType: d.receivedByIdType ?? null,
                    receivedByIdLast4: d.receivedByIdLast4 ?? null,
      },
      rawStatus: d.status,
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

  const baseFiltered =
    filter === 'all'
      ? businessOrders
      : filter === 'active'
        ? activeOrders
        : filter === 'delivered'
          ? deliveredOrders
          : cancelledOrders

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return baseFiltered
    return baseFiltered.filter(o => {
      const delivery = businessDeliveries.find(d => d.id === o.id)
      return (
        o.id.toLowerCase().includes(q) ||
        o.pickupAddress.toLowerCase().includes(q) ||
        o.dropoffAddress.toLowerCase().includes(q) ||
        (o.recipientName?.toLowerCase().includes(q) ?? false) ||
        (delivery?.recipientPhone?.includes(q) ?? false)
      )
    })
  }, [baseFiltered, searchQuery, businessDeliveries])

  const [orderPage, setOrderPage] = useState(0)
  const { page: safeOrderPage, rows: pagedOrders } = paginate(filteredOrders, orderPage, ORDER_PAGE_SIZE)

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
    const result = await cancelOrderByBusiness(cancelTarget.id, cancelReason)
    setCancelling(false)

    if (!result.ok) {
      toast.error(result.error || 'Could not cancel order')
      return
    }

    toast.success('Order cancelled', {
      description: result.fee
        ? `A $${result.fee.toFixed(2)} cancellation fee applies per your rate card.`
        : 'No cancellation fee — driver hadn\u2019t claimed yet.',
    })
    setCancelTarget(null)
    setCancelReason('')
    // If the detail sheet was open on this order, close it
    if (selectedOrder?.id === cancelTarget.id) setSelectedOrder(null)
  }

  // Edit handlers
  const openEditDialog = (delivery: Delivery) => setEditTarget(delivery)

  const handleEdited = (updated: Delivery) => {
    patchDelivery(updated.id, updated)
    setEditTarget(null)
  }

  // Duplicate handler - opens create order with pre-filled data
  const openDuplicateDialog = (delivery: Delivery) => {
    setDuplicateTarget(delivery)
  }

  if (businessOrders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border border-dashed border-border bg-card px-6 py-20 text-center">
        <div className="w-full max-w-xs">
          <RouteTrack status="en_route_pickup" />
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-lg text-foreground">No deliveries yet</h3>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
            Book your first pickup and you&apos;ll see every package move here in real time.
          </p>
        </div>
        {onNavigate && (
          <Button onClick={() => onNavigate('create')} className="rounded-full px-5">
            Book a delivery
          </Button>
        )}
      </div>
    )
  }

  const spend = deliveredOrders.reduce((sum, o) => sum + (o.price || 0), 0)
  const kpis = [
    { label: 'In progress', value: String(activeOrders.length), live: activeOrders.length > 0 },
    { label: 'Delivered', value: String(deliveredOrders.length), live: false },
    { label: 'Total orders', value: String(businessOrders.length), live: false },
    {
      label: 'Delivered spend',
      value: `$${spend.toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
      live: false,
    },
  ]
  const filters: { id: typeof filter; label: string; count: number }[] = [
    { id: 'all', label: 'All', count: businessOrders.length },
    { id: 'active', label: 'Active', count: activeOrders.length },
    { id: 'delivered', label: 'Delivered', count: deliveredOrders.length },
    { id: 'cancelled', label: 'Cancelled', count: cancelledOrders.length },
  ]

  return (
    <div className="flex flex-col gap-6 overflow-x-hidden">
      <NeedsAttention
        onOpen={(id) => {
          const o = businessOrders.find((x) => x.id === id)
          if (o) setSelectedOrder(o)
        }}
      />
      <dl className="grid grid-cols-2 overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--elevation)] lg:grid-cols-4">
        {kpis.map((kpi, i) => (
          <div
            key={kpi.label}
            className={cn(
              'flex flex-col gap-3 p-5',
              i % 2 === 1 && 'border-l border-border',
              i >= 2 && 'border-t border-border lg:border-t-0',
              i === 2 && 'lg:border-l',
            )}
          >
            <dt className="flex items-center gap-2 text-xs text-muted-foreground">
              {kpi.live && <span className="h-1.5 w-1.5 rounded-full bg-brand animate-route-pulse" aria-hidden="true" />}
              {kpi.label}
            </dt>
            <dd className="tabular text-2xl font-semibold tracking-tight text-foreground lg:text-[28px]">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="Orders" className="overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--elevation)]">
        <div className="flex flex-col gap-3 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <div role="tablist" aria-label="Filter orders" className="flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
            {filters.map(f => (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={filter === f.id}
                onClick={() => {
                  setFilter(f.id)
                  setOrderPage(0)
                }}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  filter === f.id
                    ? 'bg-card font-medium text-foreground shadow-[var(--elevation)]'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {f.label}
                <span className="tabular text-xs text-muted-foreground">{f.count}</span>
              </button>
            ))}
          </div>
          <div className="relative sm:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              value={searchQuery}
              onChange={e => {
                setSearchQuery(e.target.value)
                setOrderPage(0)
              }}
              placeholder="Search ID, address, recipient"
              aria-label="Search orders"
              className="h-9 rounded-lg pl-9 text-sm"
            />
          </div>
        </div>

        <div className="hidden grid-cols-[120px_minmax(0,1fr)_180px_150px_96px] gap-6 border-b border-border px-5 py-2.5 text-xs text-muted-foreground lg:grid">
          <span>Order</span>
          <span>Route</span>
          <span>Recipient</span>
          <span>Status</span>
          <span className="text-right">Amount</span>
        </div>

        {pagedOrders.length === 0 ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No orders match this view.</p>
        ) : (
          <ul className="divide-y divide-border">
            {pagedOrders.map(order => {
              const driver = getDriver(order.driverId)
              const delivery = getDelivery(order.id)
              const canCancel = order.status === 'posted' && !order.driverId
              const printed = !!delivery && (!!delivery.labelPrintedAt || printedIds.has(delivery.id))
              const showReorder = !!delivery && order.status !== 'posted'
              const hasActions = !!delivery?.scanToken || canCancel || showReorder

              return (
                <li key={order.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedOrder(order)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedOrder(order)
                      }
                    }}
                    className="group flex cursor-pointer flex-col gap-4 px-4 py-4 transition-colors hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none sm:px-5 lg:grid lg:grid-cols-[120px_minmax(0,1fr)_180px_150px_96px] lg:items-center lg:gap-6"
                  >
                    <div className="flex items-start justify-between gap-3 lg:flex-col lg:items-start lg:gap-1">
                      <div className="flex flex-col gap-1">
                        <span className="font-mono text-sm font-medium text-foreground">
                          #{order.id.slice(-6).toUpperCase()}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {order.createdAt ? orderTimeFormatter.format(new Date(order.createdAt)) : ''}
                          {order.priority !== 'standard' && (
                            <span className="ml-1.5 font-medium capitalize text-brand">{order.priority}</span>
                          )}
                        </span>
                      </div>
                      <div className="lg:hidden">
                        <StatusBadge status={order.status} />
                      </div>
                    </div>

                    <div className="flex min-w-0 flex-col gap-2.5">
                      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                        <span className="truncate text-foreground" title={order.pickupAddress}>
                          {order.pickupAddress}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                        <span className="truncate text-foreground" title={order.dropoffAddress}>
                          {order.dropoffAddress}
                        </span>
                      </div>
                      <RouteTrack status={order.status} />
                      {order.status === 'cancelled' && order.cancellationReason && (
                        <p className="truncate text-xs text-muted-foreground">Cancelled: {order.cancellationReason}</p>
                      )}
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-3 lg:flex-col lg:items-start lg:justify-center lg:gap-1">
                      <span className="truncate text-sm text-foreground">
                        {order.recipientName || 'No recipient name'}
                        {order.buzzCode && (
                          <span className="ml-1.5 text-xs text-muted-foreground">Buzz {order.buzzCode}</span>
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {driver ? driver.name : order.status === 'posted' ? 'Finding a courier' : 'No courier'}
                      </span>
                    </div>

                    <div className="hidden lg:block">
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="flex items-center justify-between gap-2 lg:justify-end">
                      <span className="text-xs text-muted-foreground lg:hidden">Amount</span>
                      <span className="flex items-center gap-1 tabular text-sm font-semibold text-foreground">
                        ${order.price.toFixed(2)}
                        <ChevronRight
                          className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden="true"
                        />
                      </span>
                    </div>
                  </div>

                  {hasActions && delivery && (
                    <div className="flex flex-wrap items-center gap-2 px-4 pb-4 sm:px-5 lg:pl-[calc(120px+2.75rem)]">
                      {delivery.scanToken && (
                        <>
                          <span
                            className={cn(
                              'flex items-center gap-1 text-xs',
                              printed ? 'text-success' : 'text-muted-foreground',
                            )}
                          >
                            {printed && <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />}
                            {printed ? 'Label printed' : 'Label ready'}
                          </span>
                          <LabelPrintButton
                            deliveries={[delivery]}
                            defaultSize="halfA4"
                            variant="outline"
                            className="h-7 rounded-full px-3 text-xs"
                            label={printed ? 'Reprint' : 'Print label'}
                            onPrinted={markPrinted}
                          />
                        </>
                      )}
                      {canCancel && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-full px-3 text-xs"
                            onClick={() => openEditDialog(delivery)}
                          >
                            <Pencil className="h-3 w-3" aria-hidden="true" />
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 rounded-full px-3 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => openCancelDialog(delivery)}
                          >
                            <XCircle className="h-3 w-3" aria-hidden="true" />
                            Cancel
                          </Button>
                        </>
                      )}
                      {showReorder && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 rounded-full px-3 text-xs"
                          onClick={() => openDuplicateDialog(delivery)}
                        >
                          <Copy className="h-3 w-3" aria-hidden="true" />
                          Reorder
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <ListPager
        page={safeOrderPage}
        pageSize={ORDER_PAGE_SIZE}
        total={filteredOrders.length}
        onPageChange={setOrderPage}
        itemLabel="orders"
      />

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
      <EditDeliverySheet delivery={editTarget} onClose={() => setEditTarget(null)} onSaved={handleEdited} />

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
                  setDuplicateTarget(null)
                  onNavigate?.('create')
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
