'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { StatusBadge } from './StatusBadge'
import {
  Package,
  Phone,
  XCircle,
  CheckCircle,
  UserRound,
  KeyRound,
  AlertTriangle,
} from 'lucide-react'
import { format } from 'date-fns'
import type { Driver, Business } from '@/lib/types'

// Simplified order shape used by this sheet (from BusinessOrders etc.)
export interface OrderLike {
  id: string
  businessId: string
  businessName?: string
  driverId?: string | null
  status: string
  priority: string
  pickupAddress: string
  dropoffAddress: string
  price: number
  createdAt: string
  pickupContact?: string
  dropoffContact?: string
  packageDescription?: string
  packageWeight?: number | string
  specialInstructions?: string
  requireSignature?: boolean
  requirePhoto?: boolean
  pickedUpAt?: string
  deliveredAt?: string
  recipientName?: string | null
  recipientPhone?: string | null
  buzzCode?: string | null
  cancellationReason?: string | null
}

interface OrderDetailSheetProps {
  order: OrderLike | null
  driver?: Driver | null
  business?: Business | null
  onClose: () => void
  onCancel?: () => void
  onAccept?: () => void
  viewType: 'driver' | 'business' | 'admin'
}

export function OrderDetailSheet({ 
  order, 
  driver, 
  business,
  onClose, 
  onCancel,
  onAccept,
  viewType 
}: OrderDetailSheetProps) {
  if (!order) return null

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Sheet open={!!order} onOpenChange={() => onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center justify-between">
            <SheetTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order #{order.id.slice(-6).toUpperCase()}
            </SheetTitle>
            <StatusBadge status={order.status} />
          </div>
        </SheetHeader>

        <div className="overflow-auto h-[calc(100%-80px)] space-y-6 pb-24">
          {/* Priority & Price */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
            <div>
              <p className="text-xs text-muted-foreground mb-1">Priority</p>
              <Badge variant="outline" className="capitalize">{order.priority}</Badge>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground mb-1">Price</p>
              <p className="text-2xl font-bold text-primary">${order.price.toFixed(2)}</p>
            </div>
          </div>

          {/* Recipient (if any info provided) */}
          {(order.recipientName || order.recipientPhone || order.buzzCode) && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Recipient</h4>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <UserRound className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0 space-y-1">
                  {order.recipientName && (
                    <p className="font-medium text-foreground truncate">
                      {order.recipientName}
                    </p>
                  )}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {order.recipientPhone && (
                      <a
                        href={`tel:${order.recipientPhone}`}
                        className="flex items-center gap-1 hover:text-primary"
                      >
                        <Phone className="w-3 h-3" />
                        {order.recipientPhone}
                      </a>
                    )}
                    {order.buzzCode && (
                      <span className="flex items-center gap-1">
                        <KeyRound className="w-3 h-3" />
                        Buzz {order.buzzCode}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cancellation notice */}
          {order.status === 'cancelled' && order.cancellationReason && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-destructive mb-0.5">Order cancelled</p>
                <p className="text-xs text-destructive/80">{order.cancellationReason}</p>
              </div>
            </div>
          )}

          {/* Locations */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-muted-foreground">Delivery Route</h4>
            <div className="relative pl-6">
              <div className="absolute left-2 top-2 bottom-2 w-0.5 bg-border" />
              
              <div className="relative mb-6">
                <div className="absolute -left-4 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-primary-foreground" />
                </div>
                <div className="pl-4">
                  <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                  <p className="text-sm font-medium">{order.pickupAddress}</p>
                  {order.pickupContact && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {order.pickupContact}
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <div className="absolute -left-4 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-success-foreground" />
                </div>
                <div className="pl-4">
                  <p className="text-xs text-muted-foreground mb-1">Dropoff</p>
                  <p className="text-sm font-medium">{order.dropoffAddress}</p>
                  {order.dropoffContact && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Phone className="w-3 h-3" />
                      {order.dropoffContact}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Driver Info (for business view) */}
          {viewType === 'business' && driver && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Assigned Driver</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-12 h-12">
                  <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{driver.name}</p>
                  <p className="text-xs text-muted-foreground">{driver.phone}</p>
                </div>
                <Button variant="outline" size="sm">
                  <Phone className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {/* Business Info (for driver view) */}
          {viewType === 'driver' && business && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Business</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-12 h-12">
                  <AvatarFallback>{getInitials(business.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{business.name}</p>
                </div>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Timeline</h4>
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Created</span>
                <span>{format(new Date(order.createdAt), 'MMM d, h:mm a')}</span>
              </div>
              {order.pickedUpAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Picked Up</span>
                  <span>{format(new Date(order.pickedUpAt), 'MMM d, h:mm a')}</span>
                </div>
              )}
              {order.deliveredAt && (
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Delivered</span>
                  <span>{format(new Date(order.deliveredAt), 'MMM d, h:mm a')}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-card border-t border-border safe-area-bottom">
          <div className="flex gap-3">
            {onCancel && (order.status === 'pending' || order.status === 'posted') && (
              <Button variant="destructive" className="flex-1" onClick={onCancel}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Order
              </Button>
            )}
            {onAccept && (order.status === 'pending' || order.status === 'posted') && (
              <Button className="flex-1" onClick={onAccept}>
                <CheckCircle className="w-4 h-4 mr-2" />
                Accept Order
              </Button>
            )}
            {!onCancel && !onAccept && (
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Close
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
