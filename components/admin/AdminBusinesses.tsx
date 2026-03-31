'use client'

import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { 
  Building2, 
  MapPin, 
  Phone, 
  Mail,
  Calendar
} from 'lucide-react'
import { getBusinesses } from '@/lib/db'

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

export function AdminBusinesses() {
  const { data: businesses, error, isLoading } = useSWR('admin-businesses', getBusinesses)

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
          <Building2 className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading businesses</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Businesses</h2>
        <Badge variant="secondary">{businesses?.length || 0} registered</Badge>
      </div>

      {!businesses || businesses.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Building2 className="w-10 h-10" />
          </EmptyMedia>
          <EmptyTitle>No businesses yet</EmptyTitle>
          <EmptyDescription>Businesses will appear here when they sign up</EmptyDescription>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {businesses.map((business) => (
            <Card key={business.id} className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{business.name}</h3>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p className="flex items-start gap-1">
                        <MapPin className="w-3 h-3 flex-shrink-0 mt-1" />
                        <span className="truncate">{business.address}</span>
                      </p>
                      {business.email && (
                        <p className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {business.email}
                        </p>
                      )}
                      {business.phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {business.phone}
                        </p>
                      )}
                      <p className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 flex-shrink-0" />
                        Joined {formatDate(business.created_at)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
