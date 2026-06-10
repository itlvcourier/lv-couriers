'use client'

import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Package, 
  Search,
  Filter,
  Truck,
  Building2,
  Clock,
  ChevronRight,
  MapPin,
  Zap,
  Globe,
  UserRound,
  Download,
  Check,
  X,
  Camera,
  ImageIcon,
} from 'lucide-react'
import { format } from 'date-fns'
import { getAllDeliveries, type DbDelivery } from '@/lib/db'
import type { DeliveryStatus } from '@/lib/types'
import { OrderLabelPrint } from './OrderLabelPrint'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'

export function AdminOrders() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [selectedDelivery, setSelectedDelivery] = useState<DbDelivery | null>(null)

  // Fetch deliveries from Supabase
  const { data: deliveries = [], isLoading } = useSWR('all-deliveries', () => getAllDeliveries(), {
    refreshInterval: 15000,
  })

  // Filter deliveries
  const filteredDeliveries = deliveries.filter((d: DbDelivery) => {
    const matchesSearch = 
      d.id.toLowerCase().includes(search.toLowerCase()) ||
      d.pickup_address.toLowerCase().includes(search.toLowerCase()) ||
      d.dropoff_address.toLowerCase().includes(search.toLowerCase()) ||
      (d.tracking_code?.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesStatus
  }).sort((a: DbDelivery, b: DbDelivery) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Stats
  const postedCount = deliveries.filter((d: DbDelivery) => d.status === 'posted').length
  const activeCount = deliveries.filter((d: DbDelivery) => 
    ['claimed', 'en_route_pickup', 'picked_up', 'en_route_dropoff'].includes(d.status)
  ).length
  const completedCount = deliveries.filter((d: DbDelivery) => d.status === 'delivered').length
  const flaggedCount = deliveries.filter((d: DbDelivery) => d.status === 'flagged').length

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'posted': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      case 'claimed': return 'bg-blue-500/10 text-blue-400 border-blue-500/20'
      case 'en_route_pickup': return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
      case 'picked_up': return 'bg-orange-500/10 text-orange-400 border-orange-500/20'
      case 'en_route_dropoff': return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
      case 'delivered': return 'bg-green-500/10 text-green-400 border-green-500/20'
      case 'flagged': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'failed_permanent': return 'bg-red-500/10 text-red-400 border-red-500/20'
      case 'cancelled': return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const handleExportCSV = () => {
    const headers = ['ID', 'Tracking Code', 'Status', 'Pickup Address', 'Dropoff Address', 'Recipient', 'Priority', 'Created', 'Delivered']
    const rows = filteredDeliveries.map((d: DbDelivery) => [
      d.id.slice(-8),
      d.tracking_code || '',
      d.status,
      d.pickup_address,
      d.dropoff_address,
      d.recipient_name || '',
      d.is_urgent ? 'Urgent' : d.is_rush ? 'Rush' : 'Standard',
      format(new Date(d.created_at), 'yyyy-MM-dd HH:mm'),
      d.delivered_at ? format(new Date(d.delivered_at), 'yyyy-MM-dd HH:mm') : '',
    ])
    
    const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `deliveries-${statusFilter}-${new Date().toISOString().split('T')[0]}.csv`
    link.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filteredDeliveries.length} deliveries`)
  }

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredDeliveries.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredDeliveries.map((d: DbDelivery) => d.id)))
    }
  }

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedIds(newSet)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Deliveries</h2>
          <p className="text-sm text-muted-foreground">{deliveries.length} total deliveries</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card 
          className="bg-yellow-500/5 border-yellow-500/20 cursor-pointer hover:bg-yellow-500/10 transition-colors" 
          onClick={() => setStatusFilter('posted')}
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-yellow-400">{postedCount}</p>
            <p className="text-xs text-muted-foreground">Posted</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-blue-500/5 border-blue-500/20 cursor-pointer hover:bg-blue-500/10 transition-colors" 
          onClick={() => setStatusFilter('all')}
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-blue-400">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-green-500/5 border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors" 
          onClick={() => setStatusFilter('delivered')}
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-green-400">{completedCount}</p>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </CardContent>
        </Card>
        <Card 
          className="bg-red-500/5 border-red-500/20 cursor-pointer hover:bg-red-500/10 transition-colors" 
          onClick={() => setStatusFilter('flagged')}
        >
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-red-400">{flaggedCount}</p>
            <p className="text-xs text-muted-foreground">Flagged</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by ID, tracking code, or address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DeliveryStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-44 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="claimed">Claimed</SelectItem>
            <SelectItem value="en_route_pickup">En Route Pickup</SelectItem>
            <SelectItem value="picked_up">Picked Up</SelectItem>
            <SelectItem value="en_route_dropoff">En Route Dropoff</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="failed_permanent">Failed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk Actions Bar */}
      {filteredDeliveries.length > 0 && (
        <div className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
          <Checkbox
            checked={selectedIds.size === filteredDeliveries.length && filteredDeliveries.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'Select all'}
          </span>
          {selectedIds.size > 0 && (
            <div className="flex gap-2 ml-auto">
              <OrderLabelPrint
                rows={filteredDeliveries.filter((d: DbDelivery) => selectedIds.has(d.id))}
                mode="sheet"
                size="sm"
                label="Print labels"
              />
              <Button size="sm" variant="outline" onClick={handleExportCSV}>
                <Download className="w-4 h-4 mr-1" />
                Export Selected
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Deliveries List */}
      {filteredDeliveries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Package className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No deliveries found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredDeliveries.map((delivery: DbDelivery) => (
            <div key={delivery.id} className="flex items-start gap-3">
              <Checkbox
                checked={selectedIds.has(delivery.id)}
                onCheckedChange={() => toggleSelect(delivery.id)}
                className="mt-4"
              />
              <Card 
                className="flex-1 bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                onClick={() => setSelectedDelivery(delivery)}
              >
              <CardContent className="p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {/* Delivery Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-mono">
                        {delivery.tracking_code || `#${delivery.id.slice(0, 8).toUpperCase()}`}
                      </span>
                      {delivery.is_rush && (
                        <Badge variant="outline" className="text-xs bg-orange-500/10 text-orange-400 border-orange-500/20">
                          <Zap className="w-3 h-3 mr-1" />
                          Rush
                        </Badge>
                      )}
                      {delivery.is_urgent && (
                        <Badge variant="destructive" className="text-xs">
                          Urgent
                        </Badge>
                      )}
                      {delivery.is_out_of_town && (
                        <Badge variant="outline" className="text-xs bg-purple-500/10 text-purple-400 border-purple-500/20">
                          <Globe className="w-3 h-3 mr-1" />
                          OOT
                        </Badge>
                      )}
                      <Badge variant="outline" className={`text-xs ${getStatusColor(delivery.status)}`}>
                        {formatStatus(delivery.status)}
                      </Badge>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                        <span className="truncate">{delivery.business?.name || 'Unknown Business'}</span>
                      </div>
                      {delivery.driver ? (
                        <div className="flex items-center gap-2">
                          <Truck className="w-4 h-4 text-muted-foreground shrink-0" />
                          <span className="truncate">{delivery.driver.name}</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Awaiting driver</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
                      <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                      <span className="truncate">
                        <span className="text-foreground">{delivery.pickup_area}</span>
                        {' → '}
                        <span className="text-foreground">{delivery.dropoff_area}</span>
                      </span>
                    </div>

                    {(delivery.recipient_name || delivery.buzz_code) && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        {delivery.recipient_name && (
                          <span className="flex items-center gap-1 min-w-0">
                            <UserRound className="w-3 h-3 shrink-0" />
                            <span className="truncate text-foreground">
                              {delivery.recipient_name}
                            </span>
                          </span>
                        )}
                        {delivery.buzz_code && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 bg-transparent"
                          >
                            Buzz {delivery.buzz_code}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Price & Time */}
                  <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-2">
                    {delivery.calculated_rate && (
                      <span className="text-lg font-semibold text-primary">${delivery.calculated_rate.toFixed(2)}</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(delivery.posted_at), 'MMM d, h:mm a')}
                    </span>
                    <ChevronRight className="w-5 h-5 text-muted-foreground hidden sm:block" />
                  </div>
                </div>
              </CardContent>
            </Card>
            </div>
          ))}
        </div>
      )}

      {/* Delivery Detail Sheet */}
      <Sheet open={!!selectedDelivery} onOpenChange={() => setSelectedDelivery(null)}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground flex items-center gap-2">
              <Package className="w-5 h-5" />
              {selectedDelivery?.tracking_code || `#${selectedDelivery?.id.slice(0, 8).toUpperCase()}`}
            </SheetTitle>
            <SheetDescription>
              Delivery details and timeline
            </SheetDescription>
          </SheetHeader>
          
          {selectedDelivery && (
            <div className="mt-6 space-y-6">
              {/* Status Badge + label */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={`${getStatusColor(selectedDelivery.status)}`}>
                  {formatStatus(selectedDelivery.status)}
                </Badge>
                {selectedDelivery.is_rush && (
                  <Badge variant="outline" className="bg-orange-500/10 text-orange-400 border-orange-500/20">
                    <Zap className="w-3 h-3 mr-1" />
                    Rush
                  </Badge>
                )}
                {selectedDelivery.is_urgent && (
                  <Badge variant="destructive">Urgent</Badge>
                )}
                {selectedDelivery.is_out_of_town && (
                  <Badge variant="outline" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                    <Globe className="w-3 h-3 mr-1" />
                    OOT
                  </Badge>
                )}
              </div>

              {/* Business & Driver */}
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-card-2)]">
                  <Building2 className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedDelivery.business?.name || 'Unknown Business'}</p>
                    <p className="text-xs text-muted-foreground">Business</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--bg-card-2)]">
                  <Truck className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {selectedDelivery.driver?.name || 'Awaiting driver'}
                    </p>
                    <p className="text-xs text-muted-foreground">Driver</p>
                  </div>
                </div>
              </div>

              {/* Addresses */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Route</h4>
                <div className="space-y-2">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-card-2)]">
                    <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Pickup</p>
                      <p className="text-xs text-muted-foreground break-words">{selectedDelivery.pickup_address}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-card-2)]">
                    <div className="w-2 h-2 rounded-full bg-red-500 mt-1.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">Dropoff</p>
                      <p className="text-xs text-muted-foreground break-words">{selectedDelivery.dropoff_address}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recipient Info */}
              {(selectedDelivery.recipient_name || selectedDelivery.recipient_phone || selectedDelivery.buzz_code) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Recipient</h4>
                  <div className="p-3 rounded-lg bg-[var(--bg-card-2)] space-y-2">
                    {selectedDelivery.recipient_name && (
                      <div className="flex items-center gap-2">
                        <UserRound className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm text-foreground">{selectedDelivery.recipient_name}</span>
                      </div>
                    )}
                    {selectedDelivery.recipient_phone && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Phone:</span>
                        <span className="text-sm text-foreground">{selectedDelivery.recipient_phone}</span>
                      </div>
                    )}
                    {selectedDelivery.buzz_code && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Buzz:</span>
                        <Badge variant="outline" className="text-xs">{selectedDelivery.buzz_code}</Badge>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Special Instructions */}
              {selectedDelivery.recipient_note && (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Special Instructions</h4>
                  <div className="p-3 rounded-lg bg-[var(--bg-card-2)]">
                    <p className="text-sm text-muted-foreground">{selectedDelivery.recipient_note}</p>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-foreground">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between p-2 rounded bg-[var(--bg-card-2)]">
                    <span className="text-muted-foreground">Posted</span>
                    <span className="text-foreground">{format(new Date(selectedDelivery.posted_at), 'MMM d, h:mm a')}</span>
                  </div>
                  {selectedDelivery.claimed_at && (
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-card-2)]">
                      <span className="text-muted-foreground">Claimed</span>
                      <span className="text-foreground">{format(new Date(selectedDelivery.claimed_at), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                  {selectedDelivery.picked_up_at && (
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-card-2)]">
                      <span className="text-muted-foreground">Picked Up</span>
                      <span className="text-foreground">{format(new Date(selectedDelivery.picked_up_at), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                  {selectedDelivery.delivered_at && (
                    <div className="flex justify-between p-2 rounded bg-[var(--bg-card-2)]">
                      <span className="text-muted-foreground">Delivered</span>
                      <span className="text-foreground">{format(new Date(selectedDelivery.delivered_at), 'MMM d, h:mm a')}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Proof of Delivery Section */}
              {(selectedDelivery.proof_photo_url || selectedDelivery.recipient_note) && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
                      <Camera className="w-4 h-4" />
                      Proof of Delivery
                    </h4>
                    
                    {/* Delivery Photo */}
                    {selectedDelivery.proof_photo_url && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <ImageIcon className="w-3 h-3" />
                          Delivery Photo
                        </p>
                        <div className="relative rounded-lg overflow-hidden border border-border">
                          <img 
                            src={selectedDelivery.proof_photo_url} 
                            alt="Delivery proof" 
                            className="w-full h-40 object-cover"
                          />
                          <div className="absolute top-2 left-2 px-2 py-1 rounded bg-green-500/90 text-white text-xs font-medium">
                            Delivered
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* Recipient Note */}
                    {selectedDelivery.recipient_note && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">Delivery Note</p>
                        <div className="p-3 rounded-lg bg-muted/50 border border-border">
                          <p className="text-sm text-foreground">{selectedDelivery.recipient_note}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Rate */}
              {selectedDelivery.calculated_rate && (
                <div className="flex justify-between items-center p-3 rounded-lg bg-[var(--accent-orange)]/10 border border-[var(--accent-orange)]/20">
                  <span className="text-sm font-medium text-foreground">Total Rate</span>
                  <span className="text-lg font-bold text-[var(--accent-orange)]">
                    ${selectedDelivery.calculated_rate.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
