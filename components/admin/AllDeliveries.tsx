'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Search, Package, ChevronLeft, ChevronRight } from 'lucide-react'
import { formatDateTime } from '@/lib/delivery-utils'
import type { Delivery, DeliveryStatus } from '@/lib/types'

const ITEMS_PER_PAGE = 10

const statusOptions: { value: DeliveryStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'posted', label: 'Posted' },
  { value: 'claimed', label: 'Claimed' },
  { value: 'en_route_pickup', label: 'En Route to Pickup' },
  { value: 'picked_up', label: 'Picked Up' },
  { value: 'en_route_dropoff', label: 'En Route to Drop-off' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Failed' },
]

const dateOptions = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
]

interface AllDeliveriesProps {
  onViewDelivery: (delivery: Delivery) => void
  initialDriverFilter?: string
  initialBusinessFilter?: string
}

export function AllDeliveries({
  onViewDelivery,
  initialDriverFilter = 'all',
  initialBusinessFilter = 'all',
}: AllDeliveriesProps) {
  const { deliveries, drivers, businesses } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | 'all'>('all')
  const [dateFilter, setDateFilter] = useState('all')
  const [driverFilter, setDriverFilter] = useState(initialDriverFilter)
  const [businessFilter, setBusinessFilter] = useState(initialBusinessFilter)
  const [page, setPage] = useState(1)

  const filteredDeliveries = useMemo(() => {
    let filtered = [...deliveries]

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase()
      filtered = filtered.filter(d =>
        d.businessName.toLowerCase().includes(searchLower) ||
        d.driverName?.toLowerCase().includes(searchLower) ||
        d.pickupAddress.toLowerCase().includes(searchLower) ||
        d.dropoffAddress.toLowerCase().includes(searchLower) ||
        d.id.toLowerCase().includes(searchLower)
      )
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(d => d.status === statusFilter)
    }

    // Date filter
    if (dateFilter !== 'all') {
      const now = new Date()
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())
      const startOfWeek = new Date(startOfDay)
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay())
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      filtered = filtered.filter(d => {
        const postedDate = new Date(d.postedAt)
        switch (dateFilter) {
          case 'today':
            return postedDate >= startOfDay
          case 'week':
            return postedDate >= startOfWeek
          case 'month':
            return postedDate >= startOfMonth
          default:
            return true
        }
      })
    }

    // Driver filter
    if (driverFilter !== 'all') {
      filtered = filtered.filter(d => d.driverId === driverFilter)
    }

    // Business filter
    if (businessFilter !== 'all') {
      filtered = filtered.filter(d => d.businessId === businessFilter)
    }

    // Sort by most recent
    return filtered.sort((a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime())
  }, [deliveries, search, statusFilter, dateFilter, driverFilter, businessFilter])

  // Pagination
  const totalPages = Math.ceil(filteredDeliveries.length / ITEMS_PER_PAGE)
  const paginatedDeliveries = filteredDeliveries.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE
  )

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      <h1 className="text-xl font-bold text-[#e8eaf0]">All Deliveries</h1>

      {/* Search and filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6b7280]" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Search business, driver, addresses..."
            className="pl-10 h-12 bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0] rounded-xl placeholder:text-[#6b7280]"
          />
        </div>

        {/* Filter row */}
        <div className="flex flex-wrap gap-2">
          <Select value={dateFilter} onValueChange={(v) => { setDateFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[130px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141720] border-[#1f2535]">
              {dateOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-[#e8eaf0] focus:bg-[#1a1e2a]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v as DeliveryStatus | 'all'); setPage(1); }}>
            <SelectTrigger className="w-[150px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#141720] border-[#1f2535]">
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value} className="text-[#e8eaf0] focus:bg-[#1a1e2a]">
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={driverFilter} onValueChange={(v) => { setDriverFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[140px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
              <SelectValue placeholder="Driver" />
            </SelectTrigger>
            <SelectContent className="bg-[#141720] border-[#1f2535]">
              <SelectItem value="all" className="text-[#e8eaf0] focus:bg-[#1a1e2a]">All Drivers</SelectItem>
              {drivers.map(d => (
                <SelectItem key={d.id} value={d.id} className="text-[#e8eaf0] focus:bg-[#1a1e2a]">
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={businessFilter} onValueChange={(v) => { setBusinessFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[150px] bg-[#1a1e2a] border-[#1f2535] text-[#e8eaf0]">
              <SelectValue placeholder="Business" />
            </SelectTrigger>
            <SelectContent className="bg-[#141720] border-[#1f2535]">
              <SelectItem value="all" className="text-[#e8eaf0] focus:bg-[#1a1e2a]">All Businesses</SelectItem>
              {businesses.map(b => (
                <SelectItem key={b.id} value={b.id} className="text-[#e8eaf0] focus:bg-[#1a1e2a]">
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results */}
      {paginatedDeliveries.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No deliveries found"
          subtitle="Try adjusting your search or filters"
        />
      ) : (
        <>
          {/* Table */}
          <div className="bg-[#141720] border border-[#1f2535] rounded-2xl overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1f2535]">
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">ID</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Business</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Driver</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3 hidden lg:table-cell">Pickup</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3 hidden lg:table-cell">Drop-off</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3">Posted</th>
                  <th className="text-left text-xs font-medium text-[#6b7280] px-4 py-3 hidden lg:table-cell">Duration</th>
                </tr>
              </thead>
              <tbody>
                {paginatedDeliveries.map(delivery => (
                  <tr
                    key={delivery.id}
                    onClick={() => onViewDelivery(delivery)}
                    className="border-b border-[#1f2535] hover:bg-[#1a1e2a] cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-[#e8eaf0] font-mono">{delivery.id}</td>
                    <td className="px-4 py-3 text-sm text-[#e8eaf0]">{delivery.businessName}</td>
                    <td className="px-4 py-3 text-sm text-[#6b7280]">{delivery.driverName || '-'}</td>
                    <td className="px-4 py-3 text-sm text-[#6b7280] hidden lg:table-cell">{delivery.pickupArea}</td>
                    <td className="px-4 py-3 text-sm text-[#6b7280] hidden lg:table-cell">{delivery.dropoffArea}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={delivery.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-[#6b7280]">{formatDateTime(delivery.postedAt)}</td>
                    <td className="px-4 py-3 text-sm text-orange-500 hidden lg:table-cell">{delivery.duration || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-sm text-[#6b7280]">
                Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, filteredDeliveries.length)} of {filteredDeliveries.length}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="h-9 border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0] disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-[#6b7280] px-2">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="h-9 border-[#1f2535] hover:bg-[#1f2535] text-[#e8eaf0] disabled:opacity-50"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
