'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyIcon, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Package, 
  MapPin, 
  Clock, 
  User,
  Phone,
  CheckCircle,
  XCircle,
  Truck,
  ChevronRight,
  Eye
} from 'lucide-react'
import { getBusinessDeliveries } from '@/lib/db'
import type { DbDelivery, DeliveryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

interface MyDeliveriesProps {
  businessId: string
}

type FilterTab = 'all' | 'active' | 'completed'

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
}

function formatRelativeTime(dateString: string) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return formatDate(dateString)
}

function isCompletedStatus(status: DeliveryStatus) {
  return status === 'delivered' || status === 'failed'
}

function getStatusInfo(status: DeliveryStatus) {
  switch (status) {
    case 'posted':
      return { label: 'Posted', color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' }
    case 'claimed':
      return { label: 'Claimed', color: 'bg-blue-500/10 text-blue-500 border-blue-500/20' }
    case 'in_transit':
      return { label: 'In Transit', color: 'bg-purple-500/10 text-purple-500 border-purple-500/20' }
    case 'delivered':
      return { label: 'Delivered', color: 'bg-green-500/10 text-green-500 border-green-500/20' }
    case 'failed':
      return { label: 'Failed', color: 'bg-red-500/10 text-red-500 border-red-500/20' }
    default:
      return { label: status, color: 'bg-muted text-muted-foreground' }
  }
}

export function MyDeliveries({ businessId }: MyDeliveriesProps) {
  const { data: deliveries, error, isLoading } = useSWR(
    ['business-deliveries', businessId],
    () => getBusinessDeliveries(businessId),
    { refreshInterval: 30000 }
  )

  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')
  const [selectedDelivery, setSelectedDelivery] = useState<DbDelivery | null>(null)

  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return []
    
    switch (activeFilter) {
      case 'active':
        return deliveries.filter(d => !isCompletedStatus(d.status))
      case 'completed':
        return deliveries.filter(d => isCompletedStatus(d.status))
      default:
        return deliveries
    }
  }, [deliveries, activeFilter])

  const counts = useMemo(() => {
    if (!deliveries) return { all: 0, active: 0, completed: 0 }
    return {
      all: deliveries.length,
      active: deliveries.filter(d => !isCompletedStatus(d.status)).length,
      completed: deliveries.filter(d => isCompletedStatus(d.status)).length,
    }
  }, [deliveries])

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty>
        <EmptyIcon>
          <Package className="w-10 h-10" />
        </EmptyIcon>
        <EmptyTitle>Error loading deliveries</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
        {(['all', 'active', 'completed'] as FilterTab[]).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveFilter(tab)}
            className={cn(
              'flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all',
              activeFilter === tab
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Deliveries list */}
      {filteredDeliveries.length === 0 ? (
        <Empty>
          <EmptyIcon>
            <Package className="w-10 h-10" />
          </EmptyIcon>
          <EmptyTitle>No {activeFilter === 'all' ? '' : activeFilter} deliveries</EmptyTitle>
          <EmptyDescription>
            {activeFilter === 'all' ? 'Post a delivery to get started' : 'Check other tabs'}
          </EmptyDescription>
        </Empty>
      ) : (
        filteredDeliveries.map((delivery) => {
          const statusInfo = getStatusInfo(delivery.status)
          
          return (
            <Card 
              key={delivery.id} 
              className={cn(
                "border-border/50 bg-card/50 cursor-pointer hover:bg-card/80 transition-colors",
                delivery.priority === 'rush' && 'border-l-4 border-l-orange-500'
              )}
              onClick={() => setSelectedDelivery(delivery)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{delivery.dropoff_contact}</span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{delivery.dropoff_address}</p>
                  </div>
                  <Badge variant="outline" className={cn("ml-2 flex-shrink-0", statusInfo.color)}>
                    {statusInfo.label}
                  </Badge>
                </div>

                {/* Driver info */}
                <div className="flex items-center gap-2 mb-3">
                  {delivery.driver ? (
                    <>
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-xs bg-primary/10 text-primary">
                          {delivery.driver.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm">{delivery.driver.name}</span>
                      {delivery.status === 'in_transit' && (
                        <Badge variant="secondary" className="ml-auto text-xs gap-1">
                          <Truck className="w-3 h-3" />
                          En Route
                        </Badge>
                      )}
                    </>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Awaiting driver...</span>
                  )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-border/50">
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeTime(delivery.posted_at)}
                    </span>
                    <Badge variant="outline" className="text-xs">{delivery.package_size}</Badge>
                    {delivery.priority === 'rush' && (
                      <Badge variant="destructive" className="text-xs">RUSH</Badge>
                    )}
                  </div>
                  <span className="font-medium text-primary">${Number(delivery.payout).toFixed(2)}</span>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}

      {/* Detail sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader className="mb-4">
                <div className="flex items-center justify-between">
                  <SheetTitle>Delivery Details</SheetTitle>
                  <Badge variant="outline" className={getStatusInfo(selectedDelivery.status).color}>
                    {getStatusInfo(selectedDelivery.status).label}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="space-y-4">
                {/* Payout */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">Payout</span>
                  <span className="text-lg font-bold text-primary">
                    ${Number(selectedDelivery.payout).toFixed(2)}
                  </span>
                </div>

                {/* Package info */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{selectedDelivery.package_size}</Badge>
                  {selectedDelivery.priority === 'rush' && (
                    <Badge variant="destructive">RUSH</Badge>
                  )}
                  {selectedDelivery.package_description && (
                    <span className="text-sm text-muted-foreground">{selectedDelivery.package_description}</span>
                  )}
                </div>

                {/* Addresses */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-green-500" />
                      Pickup
                    </p>
                    <p className="text-sm font-medium">{selectedDelivery.pickup_contact}</p>
                    <p className="text-sm text-muted-foreground">{selectedDelivery.pickup_address}</p>
                    {selectedDelivery.pickup_phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" />
                        {selectedDelivery.pickup_phone}
                      </p>
                    )}
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      Dropoff
                    </p>
                    <p className="text-sm font-medium">{selectedDelivery.dropoff_contact}</p>
                    <p className="text-sm text-muted-foreground">{selectedDelivery.dropoff_address}</p>
                    {selectedDelivery.dropoff_phone && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                        <Phone className="w-3 h-3" />
                        {selectedDelivery.dropoff_phone}
                      </p>
                    )}
                  </div>
                </div>

                {/* Driver info */}
                {selectedDelivery.driver && (
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-2">Assigned Driver</p>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedDelivery.driver.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{selectedDelivery.driver.name}</p>
                        {selectedDelivery.driver.phone && (
                          <a 
                            href={`tel:${selectedDelivery.driver.phone}`}
                            className="text-sm text-primary flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {selectedDelivery.driver.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Posted</p>
                    <p>{formatDate(selectedDelivery.posted_at)}</p>
                  </div>
                  {selectedDelivery.claimed_at && (
                    <div>
                      <p className="text-muted-foreground">Claimed</p>
                      <p>{formatDate(selectedDelivery.claimed_at)}</p>
                    </div>
                  )}
                  {selectedDelivery.picked_up_at && (
                    <div>
                      <p className="text-muted-foreground">Picked Up</p>
                      <p>{formatDate(selectedDelivery.picked_up_at)}</p>
                    </div>
                  )}
                  {selectedDelivery.delivered_at && (
                    <div>
                      <p className="text-muted-foreground">Completed</p>
                      <p>{formatDate(selectedDelivery.delivered_at)}</p>
                    </div>
                  )}
                </div>

                {/* Fail reason */}
                {selectedDelivery.status === 'failed' && selectedDelivery.fail_reason && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                    <p className="text-xs text-red-500 mb-1">Failure Reason</p>
                    <p className="text-sm">{selectedDelivery.fail_reason}</p>
                  </div>
                )}

                {/* Proof photo */}
                {selectedDelivery.proof_photo_url && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-2">Proof of Delivery</p>
                    <img
                      src={selectedDelivery.proof_photo_url}
                      alt="Proof of delivery"
                      className="w-full h-48 object-cover rounded-xl bg-muted"
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
