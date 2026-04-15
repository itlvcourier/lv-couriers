'use client'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { StatusBadge } from './StatusBadge'
import { 
  MapPin, 
  Package, 
  Phone, 
  Clock, 
  DollarSign,
  User,
  Truck,
  FileText,
  Camera,
  CheckCircle,
  XCircle,
  Navigation
} from 'lucide-react'
import { format } from 'date-fns'
import type { Order, Driver, Business } from '@/lib/types'

interface OrderDetailSheetProps {
  order: Order | null
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

          {/* Package Details */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">Package Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="text-sm font-medium">{order.packageDescription}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground mb-1">Weight</p>
                <p className="text-sm font-medium">{order.packageWeight} lbs</p>
              </div>
            </div>
            {order.specialInstructions && (
              <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning mb-1 flex items-center gap-1">
                  <FileText className="w-3 h-3" />
                  Special Instructions
                </p>
                <p className="text-sm">{order.specialInstructions}</p>
              </div>
            )}
            <div className="flex gap-2">
              {order.requireSignature && (
                <Badge variant="secondary" className="text-xs">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Signature Required
                </Badge>
              )}
              {order.requirePhoto && (
                <Badge variant="secondary" className="text-xs">
                  <Camera className="w-3 h-3 mr-1" />
                  Photo Required
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Driver Info (for business view) */}
          {viewType === 'business' && driver && (
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-muted-foreground">Assigned Driver</h4>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={driver.avatar} />
                  <AvatarFallback>{getInitials(driver.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{driver.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {driver.vehicleType} - {driver.licensePlate}
                  </p>
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
                  <AvatarImage src={business.avatar} />
                  <AvatarFallback>{getInitials(business.name)}</AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-medium">{business.name}</p>
                  <p className="text-xs text-muted-foreground capitalize">
                    {business.businessType}
                  </p>
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
            {onCancel && order.status === 'pending' && (
              <Button variant="destructive" className="flex-1" onClick={onCancel}>
                <XCircle className="w-4 h-4 mr-2" />
                Cancel Order
              </Button>
            )}
            {onAccept && order.status === 'pending' && (
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
