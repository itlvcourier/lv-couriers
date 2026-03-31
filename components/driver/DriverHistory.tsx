'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyIcon, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { 
  MapPin, 
  Clock, 
  History,
  CheckCircle,
  XCircle,
  ChevronRight,
  Package,
  DollarSign
} from 'lucide-react'
import { getDriverHistory } from '@/lib/db'
import type { DbDelivery } from '@/lib/types'

interface DriverHistoryProps {
  driverId: string
}

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

export function DriverHistory({ driverId }: DriverHistoryProps) {
  const { data: deliveries, error, isLoading } = useSWR(
    ['driver-history', driverId],
    () => getDriverHistory(driverId)
  )

  const [selectedDelivery, setSelectedDelivery] = useState<DbDelivery | null>(null)

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
          <History className="w-10 h-10" />
        </EmptyIcon>
        <EmptyTitle>Error loading history</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <Empty>
        <EmptyIcon>
          <History className="w-10 h-10" />
        </EmptyIcon>
        <EmptyTitle>No delivery history</EmptyTitle>
        <EmptyDescription>Completed deliveries will appear here</EmptyDescription>
      </Empty>
    )
  }

  // Calculate stats
  const completedCount = deliveries.filter(d => d.status === 'delivered').length
  const failedCount = deliveries.filter(d => d.status === 'failed').length
  const totalEarnings = deliveries
    .filter(d => d.status === 'delivered')
    .reduce((sum, d) => sum + Number(d.payout), 0)

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{failedCount}</p>
            <p className="text-xs text-muted-foreground">Failed</p>
          </CardContent>
        </Card>
        <Card className="border-border/50 bg-card/50">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold">Recent Deliveries</h2>

      {deliveries.map((delivery) => (
        <Card 
          key={delivery.id} 
          className="border-border/50 bg-card/50 cursor-pointer hover:bg-card/80 transition-colors"
          onClick={() => setSelectedDelivery(delivery)}
        >
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {delivery.status === 'delivered' ? (
                    <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                  )}
                  <span className="font-medium truncate">{delivery.business?.name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    <span className="truncate max-w-[150px]">{delivery.dropoff_address.split(',')[0]}</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatRelativeTime(delivery.delivered_at || delivery.created_at)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-primary">
                  ${Number(delivery.payout).toFixed(2)}
                </span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Detail sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={(open) => !open && setSelectedDelivery(null)}>
        <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
          {selectedDelivery && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="flex items-center justify-between">
                  <span>{selectedDelivery.business?.name}</span>
                  <Badge variant={selectedDelivery.status === 'delivered' ? 'default' : 'destructive'}>
                    {selectedDelivery.status === 'delivered' ? 'Completed' : 'Failed'}
                  </Badge>
                </SheetTitle>
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
                <div className="flex items-center gap-3">
                  <Badge variant="outline">{selectedDelivery.package_size}</Badge>
                  {selectedDelivery.priority === 'rush' && (
                    <Badge variant="destructive">RUSH</Badge>
                  )}
                </div>

                {/* Addresses */}
                <div className="space-y-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Pickup</p>
                    <p className="text-sm font-medium">{selectedDelivery.pickup_contact}</p>
                    <p className="text-sm text-muted-foreground">{selectedDelivery.pickup_address}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground mb-1">Dropoff</p>
                    <p className="text-sm font-medium">{selectedDelivery.dropoff_contact}</p>
                    <p className="text-sm text-muted-foreground">{selectedDelivery.dropoff_address}</p>
                  </div>
                </div>

                {/* Timestamps */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Posted</p>
                    <p>{formatDate(selectedDelivery.posted_at)}</p>
                  </div>
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
