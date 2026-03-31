'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { 
  MapPin, 
  Package, 
  Truck,
  Navigation,
  CheckCircle,
  AlertTriangle,
  Phone,
  ExternalLink,
  Camera
} from 'lucide-react'
import { toast } from 'sonner'
import { 
  getDriverActiveDeliveries, 
  startDelivery, 
  completeDelivery, 
  failDelivery 
} from '@/lib/db'
import type { DbDelivery, FailReason } from '@/lib/types'

const failReasons: FailReason[] = [
  'No one home',
  'Wrong address',
  'Package refused',
  'Unable to access location',
  'Other',
]

interface ActiveDeliveriesProps {
  driverId: string
}

export function ActiveDeliveries({ driverId }: ActiveDeliveriesProps) {
  const { data: deliveries, error, isLoading, mutate } = useSWR(
    ['active-deliveries', driverId],
    () => getDriverActiveDeliveries(driverId),
    { refreshInterval: 10000 }
  )

  const [processingId, setProcessingId] = useState<string | null>(null)
  const [showCompleteSheet, setShowCompleteSheet] = useState(false)
  const [showFailSheet, setShowFailSheet] = useState(false)
  const [selectedDelivery, setSelectedDelivery] = useState<DbDelivery | null>(null)
  const [failReason, setFailReason] = useState<FailReason | ''>('')

  const handleStartDelivery = async (delivery: DbDelivery) => {
    setProcessingId(delivery.id)
    try {
      await startDelivery(delivery.id)
      toast.success('Package picked up! Starting delivery.')
      mutate()
    } catch (error) {
      toast.error('Failed to update status')
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleCompleteDelivery = async () => {
    if (!selectedDelivery) return
    setProcessingId(selectedDelivery.id)
    try {
      await completeDelivery(selectedDelivery.id)
      toast.success('Delivery completed!')
      setShowCompleteSheet(false)
      setSelectedDelivery(null)
      mutate()
    } catch (error) {
      toast.error('Failed to complete delivery')
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const handleFailDelivery = async () => {
    if (!selectedDelivery || !failReason) return
    setProcessingId(selectedDelivery.id)
    try {
      await failDelivery(selectedDelivery.id, failReason)
      toast.error('Delivery marked as failed')
      setShowFailSheet(false)
      setSelectedDelivery(null)
      setFailReason('')
      mutate()
    } catch (error) {
      toast.error('Failed to update status')
      console.error(error)
    } finally {
      setProcessingId(null)
    }
  }

  const openMaps = (address: string) => {
    window.open(`https://maps.google.com/?q=${encodeURIComponent(address)}`, '_blank')
  }

  const callPhone = (phone: string | null) => {
    if (phone) {
      window.open(`tel:${phone}`, '_self')
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
          <Truck className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading deliveries</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Truck className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>No active deliveries</EmptyTitle>
        <EmptyDescription>Claim a job from the Available tab to get started</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Active Deliveries</h2>
        <Badge variant="secondary">{deliveries.length} active</Badge>
      </div>

      {deliveries.map((delivery, index) => (
        <Card key={delivery.id} className="border-border/50 bg-card/50">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {index + 1}
                </span>
                <CardTitle className="text-base">{delivery.business?.name || 'Delivery'}</CardTitle>
              </div>
              <div className="flex items-center gap-2">
                <Badge 
                  variant={delivery.status === 'in_transit' ? 'default' : 'secondary'}
                  className={delivery.status === 'in_transit' ? 'bg-blue-500' : ''}
                >
                  {delivery.status === 'claimed' ? 'Pickup' : 'In Transit'}
                </Badge>
                {delivery.priority === 'rush' && (
                  <Badge variant="destructive">RUSH</Badge>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="space-y-4">
            {/* Current destination based on status */}
            {delivery.status === 'claimed' ? (
              // Show pickup location
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-green-500" />
                  <span className="text-sm font-medium text-green-500">Pickup Location</span>
                </div>
                <p className="text-sm mb-1">{delivery.pickup_contact}</p>
                <p className="text-sm text-muted-foreground mb-3">{delivery.pickup_address}</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => openMaps(delivery.pickup_address)}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate
                  </Button>
                  {delivery.pickup_phone && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => callPhone(delivery.pickup_phone)}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              // Show dropoff location
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-medium text-red-500">Dropoff Location</span>
                </div>
                <p className="text-sm mb-1">{delivery.dropoff_contact}</p>
                <p className="text-sm text-muted-foreground mb-3">{delivery.dropoff_address}</p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="flex-1"
                    onClick={() => openMaps(delivery.dropoff_address)}
                  >
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate
                  </Button>
                  {delivery.dropoff_phone && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => callPhone(delivery.dropoff_phone)}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Package info */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Package className="w-4 h-4" />
                {delivery.package_size}
              </span>
              {delivery.package_description && (
                <span className="truncate">{delivery.package_description}</span>
              )}
              <span className="ml-auto font-medium text-primary">
                ${Number(delivery.payout).toFixed(2)}
              </span>
            </div>

            {/* Action button */}
            {delivery.status === 'claimed' ? (
              <Button 
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() => handleStartDelivery(delivery)}
                disabled={processingId === delivery.id}
              >
                {processingId === delivery.id ? (
                  <Spinner className="mr-2" />
                ) : (
                  <CheckCircle className="w-4 h-4 mr-2" />
                )}
                Confirm Pickup
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  className="flex-1 bg-green-600 hover:bg-green-700"
                  onClick={() => {
                    setSelectedDelivery(delivery)
                    setShowCompleteSheet(true)
                  }}
                  disabled={processingId === delivery.id}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Complete
                </Button>
                <Button 
                  variant="outline"
                  className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                  onClick={() => {
                    setSelectedDelivery(delivery)
                    setShowFailSheet(true)
                  }}
                  disabled={processingId === delivery.id}
                >
                  <AlertTriangle className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Complete delivery sheet */}
      <Sheet open={showCompleteSheet} onOpenChange={setShowCompleteSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle>Complete Delivery</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirm that you have successfully delivered the package to {selectedDelivery?.dropoff_contact}.
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setShowCompleteSheet(false)}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handleCompleteDelivery}
                disabled={processingId !== null}
              >
                {processingId ? <Spinner className="mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Confirm Delivered
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Fail delivery sheet */}
      <Sheet open={showFailSheet} onOpenChange={setShowFailSheet}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Report Failed Delivery
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <Select value={failReason} onValueChange={(value) => setFailReason(value as FailReason)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a reason..." />
              </SelectTrigger>
              <SelectContent>
                {failReasons.map(reason => (
                  <SelectItem key={reason} value={reason}>
                    {reason}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setShowFailSheet(false)
                  setFailReason('')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={handleFailDelivery}
                disabled={!failReason || processingId !== null}
              >
                {processingId ? <Spinner className="mr-2" /> : null}
                Confirm Failed
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
