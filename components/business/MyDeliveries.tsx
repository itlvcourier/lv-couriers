'use client'

import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Package } from 'lucide-react'

interface MyDeliveriesProps {
  businessId: string
}

interface DeliveryRow {
  id: string
  pickup_address: string | null
  dropoff_address: string | null
  status: string | null
  posted_at: string | null
  recipient_name: string | null
}

async function fetchBusinessDeliveries(businessId: string): Promise<DeliveryRow[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('deliveries')
    .select('id, pickup_address, dropoff_address, status, posted_at, recipient_name')
    .eq('business_id', businessId)
    .order('created_at', { ascending: false })
    .limit(50)

  if (error) throw new Error(error.message)
  return (data ?? []) as DeliveryRow[]
}

export function MyDeliveries({ businessId }: MyDeliveriesProps) {
  const { data: deliveries, isLoading, error } = useSWR(
    businessId ? ['my-deliveries', businessId] : null,
    () => fetchBusinessDeliveries(businessId),
    { refreshInterval: 15000 },
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner />
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
        <EmptyDescription>{error.message}</EmptyDescription>
      </Empty>
    )
  }

  if (!deliveries || deliveries.length === 0) {
    return (
      <Empty>
        <EmptyMedia>
          <Package className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>No deliveries posted</EmptyTitle>
        <EmptyDescription>Create a new delivery to get started</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-4">
      {deliveries.map((delivery) => (
        <Card key={delivery.id}>
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base">{delivery.pickup_address}</CardTitle>
              <Badge variant="outline" className="capitalize shrink-0">
                {delivery.status?.replace(/_/g, ' ')}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 text-sm text-muted-foreground">
              <p><span className="font-medium text-foreground">Dropoff:</span> {delivery.dropoff_address}</p>
              {delivery.recipient_name && (
                <p><span className="font-medium text-foreground">Recipient:</span> {delivery.recipient_name}</p>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
