'use client'

import { useState, useMemo } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { 
  Package, 
  MapPin, 
  Clock,
  Building2,
  Truck,
  Phone,
  Filter
} from 'lucide-react'
import { getAllDeliveries, getDrivers, reassignDelivery } from '@/lib/db'
import { toast } from 'sonner'
import type { DbDelivery, DeliveryStatus } from '@/lib/types'
import { cn } from '@/lib/utils'

type FilterStatus = 'all' | DeliveryStatus

function formatDate(dateString: string) {
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  })
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

export function AdminDeliveries() {
  const { data: deliveries, error, isLoading, mutate } = useSWR('admin-deliveries', () => getAllDeliveries(), {
    refreshInterval: 30000,
  })
  const { data: drivers } = useSWR('admin-drivers-list', getDrivers)
  
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all')
  const [selectedDelivery, setSelectedDelivery] = useState<DbDelivery | null>(null)
  const [reassigning, setReassigning] = useState(false)

  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return []
    if (statusFilter === 'all') return deliveries
    return deliveries.filter(d => d.status === statusFilter)
  }, [deliveries, statusFilter])

  const handleReassign = async (deliveryId: string, newDriverId: string) => {
    setReassigning(true)
    try {
      await reassignDelivery(deliveryId, newDriverId)
      toast.success('Driver reassigned successfully')
      mutate()
      setSelectedDelivery(null)
    } catch (error) {
      toast.error('Failed to reassign driver')
      console.error(error)
    } finally {
      setReassigning(false)
    }
  }

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
        <EmptyMedia>
          <Package className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading deliveries</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-2xl font-bold">All Deliveries</h2>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as FilterStatus)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="claimed">Claimed</SelectItem>
              <SelectItem value="in_transit">In Transit</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {filteredDeliveries.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Package className="w-10 h-10" />
          </EmptyMedia>
          <EmptyTitle>No deliveries found</EmptyTitle>
          <EmptyDescription>
            {statusFilter === 'all' ? 'No deliveries have been posted yet' : `No ${statusFilter} deliveries`}
          </EmptyDescription>
        </Empty>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((delivery) => {
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
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <span className="font-medium truncate">{delivery.business?.name || 'Unknown'}</span>
                        <Badge variant="outline" className={cn("flex-shrink-0", statusInfo.color)}>
                          {statusInfo.label}
                        </Badge>
                        {delivery.priority === 'rush' && (
                          <Badge variant="destructive" className="flex-shrink-0">RUSH</Badge>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-muted-foreground">
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-green-500 flex-shrink-0 mt-1" />
                          <span className="truncate">{delivery.pickup_address}</span>
                        </div>
                        <div className="flex items-start gap-1">
                          <MapPin className="w-3 h-3 text-red-500 flex-shrink-0 mt-1" />
                          <span className="truncate">{delivery.dropoff_address}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 mt-3 text-sm">
                        {delivery.driver ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="w-5 h-5">
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {delivery.driver.name.split(' ').map(n => n[0]).join('')}
                              </AvatarFallback>
                            </Avatar>
                            <span>{delivery.driver.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic">No driver</span>
                        )}
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDate(delivery.posted_at)}
                        </span>
                        <span className="font-medium text-primary ml-auto">
                          ${Number(delivery.payout).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center justify-between">
                  <span>Delivery Details</span>
                  <Badge variant="outline" className={getStatusInfo(selectedDelivery.status).color}>
                    {getStatusInfo(selectedDelivery.status).label}
                  </Badge>
                </SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                {/* Business */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">Business</p>
                  <p className="font-medium">{selectedDelivery.business?.name}</p>
                </div>

                {/* Payout */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10">
                  <span className="text-sm font-medium">Payout</span>
                  <span className="text-lg font-bold text-primary">
                    ${Number(selectedDelivery.payout).toFixed(2)}
                  </span>
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
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      Dropoff
                    </p>
                    <p className="text-sm font-medium">{selectedDelivery.dropoff_contact}</p>
                    <p className="text-sm text-muted-foreground">{selectedDelivery.dropoff_address}</p>
                  </div>
                </div>

                {/* Driver with reassign */}
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-2">Assigned Driver</p>
                  {selectedDelivery.driver ? (
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {selectedDelivery.driver.name.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <p className="font-medium">{selectedDelivery.driver.name}</p>
                        {selectedDelivery.driver.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {selectedDelivery.driver.phone}
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground italic">No driver assigned</p>
                  )}

                  {/* Reassign option for active deliveries */}
                  {['claimed', 'in_transit'].includes(selectedDelivery.status) && drivers && (
                    <div className="mt-3 pt-3 border-t border-border">
                      <p className="text-xs text-muted-foreground mb-2">Reassign to:</p>
                      <Select
                        onValueChange={(value) => handleReassign(selectedDelivery.id, value)}
                        disabled={reassigning}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select driver..." />
                        </SelectTrigger>
                        <SelectContent>
                          {drivers
                            .filter(d => d.id !== selectedDelivery.driver_id)
                            .map(driver => (
                              <SelectItem key={driver.id} value={driver.id}>
                                {driver.name} ({driver.status})
                              </SelectItem>
                            ))
                          }
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

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
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
