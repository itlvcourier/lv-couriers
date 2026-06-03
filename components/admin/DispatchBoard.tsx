'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Package,
  Truck,
  Clock,
  MapPin,
  Zap,
  Globe,
  UserPlus,
  Search,
  Users,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Phone,
  RefreshCw,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import type { Delivery, Driver, DeliveryStatus } from '@/lib/types'

export function DispatchBoard() {
  const {
    deliveries,
    drivers,
    settings,
    currentUser,
    assignDelivery,
    reassignDriver,
    getDriverActiveJobs,
    getDriverMaxJobs,
  } = useApp()

  const [search, setSearch] = useState('')
  const [driverFilter, setDriverFilter] = useState<string>('all')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  // Unassigned deliveries (status = posted)
  const unassignedDeliveries = useMemo(() => {
    return deliveries
      .filter(d => d.status === 'posted')
      .sort((a, b) => {
        // Rush jobs first
        if (a.isRush && !b.isRush) return -1
        if (!a.isRush && b.isRush) return 1
        // Then by posted time (oldest first)
        return new Date(a.postedAt).getTime() - new Date(b.postedAt).getTime()
      })
  }, [deliveries])

  // Active deliveries (claimed, en_route_*, picked_up)
  const activeDeliveries = useMemo(() => {
    const activeStatuses: DeliveryStatus[] = [
      'claimed',
      'en_route_pickup',
      'picked_up',
      'en_route_dropoff',
    ]
    let filtered = deliveries.filter(d => activeStatuses.includes(d.status))
    
    if (driverFilter !== 'all') {
      filtered = filtered.filter(d => d.driverId === driverFilter)
    }
    
    if (search) {
      const q = search.toLowerCase()
      filtered = filtered.filter(
        d =>
          d.businessName.toLowerCase().includes(q) ||
          d.dropoffAddress.toLowerCase().includes(q) ||
          d.driverName?.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
      )
    }
    
    return filtered.sort(
      (a, b) => new Date(b.claimedAt || b.postedAt).getTime() - new Date(a.claimedAt || a.postedAt).getTime()
    )
  }, [deliveries, driverFilter, search])

  // Active drivers (not off_duty)
  const activeDrivers = useMemo(() => {
    return drivers
      .filter(d => d.inviteStatus === 'active')
      .sort((a, b) => {
        // Available first, then on_delivery, then off_duty
        const order = { available: 0, on_delivery: 1, off_duty: 2 }
        return order[a.status] - order[b.status]
      })
  }, [drivers])

  const handleAssign = (deliveryId: string, driverId: string) => {
    if (!currentUser) return
    setAssigningId(deliveryId)
    // Pass the admin's auth UUID so it persists into deliveries.assigned_by.
    // (Falls back to empty string; assignDelivery safely omits non-UUIDs.)
    const adminUserId = currentUser.id ?? ''
    assignDelivery(deliveryId, driverId, adminUserId)
    setTimeout(() => setAssigningId(null), 500)
  }

  const handleReassign = (deliveryId: string, newDriverId: string) => {
    reassignDriver(deliveryId, newDriverId)
  }

  const getStatusColor = (status: DeliveryStatus) => {
    switch (status) {
      case 'claimed':
        return 'bg-blue-500/10 text-blue-600 border-blue-500/20'
      case 'en_route_pickup':
        return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20'
      case 'picked_up':
        return 'bg-orange-500/10 text-orange-600 border-orange-500/20'
      case 'en_route_dropoff':
        return 'bg-purple-500/10 text-purple-600 border-purple-500/20'
      default:
        return 'bg-gray-500/10 text-gray-600 border-gray-500/20'
    }
  }

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  }

  const getDriverStatusIndicator = (driver: Driver) => {
    const activeJobs = getDriverActiveJobs(driver.id)
    const maxJobs = getDriverMaxJobs(driver.id)
    
    if (driver.status === 'off_duty') {
      return { color: 'bg-gray-400', text: 'Off Duty' }
    }
    if (driver.status === 'on_delivery') {
      return { color: 'bg-yellow-500', text: 'On Delivery' }
    }
    if (activeJobs >= maxJobs) {
      return { color: 'bg-orange-500', text: 'At Capacity' }
    }
    return { color: 'bg-green-500', text: 'Available' }
  }

  // Show dispatch mode warning if self-claim is enabled
  if (settings.allowDriverSelfClaim) {
    return (
      <div className="space-y-6">
        <Card className="border-yellow-500/50 bg-yellow-500/5">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="w-6 h-6 text-yellow-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-foreground mb-1">
                  Driver Self-Claim Mode Active
                </h3>
                <p className="text-sm text-muted-foreground mb-3">
                  Drivers can currently claim their own jobs. To use the Dispatch Board for
                  manual assignment, disable self-claim in Settings.
                </p>
                <p className="text-xs text-muted-foreground">
                  Go to Settings → Dispatch Mode → Select &quot;Admin Assignment&quot;
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Still show the board for monitoring purposes */}
        <div className="opacity-60">
          <DispatchBoardContent
            unassignedDeliveries={unassignedDeliveries}
            activeDeliveries={activeDeliveries}
            activeDrivers={activeDrivers}
            search={search}
            setSearch={setSearch}
            driverFilter={driverFilter}
            setDriverFilter={setDriverFilter}
            assigningId={assigningId}
            handleAssign={handleAssign}
            handleReassign={handleReassign}
            getStatusColor={getStatusColor}
            formatStatus={formatStatus}
            getDriverStatusIndicator={getDriverStatusIndicator}
            getDriverActiveJobs={getDriverActiveJobs}
            getDriverMaxJobs={getDriverMaxJobs}
            disabled
          />
        </div>
      </div>
    )
  }

  return (
    <DispatchBoardContent
      unassignedDeliveries={unassignedDeliveries}
      activeDeliveries={activeDeliveries}
      activeDrivers={activeDrivers}
      search={search}
      setSearch={setSearch}
      driverFilter={driverFilter}
      setDriverFilter={setDriverFilter}
      assigningId={assigningId}
      handleAssign={handleAssign}
      handleReassign={handleReassign}
      getStatusColor={getStatusColor}
      formatStatus={formatStatus}
      getDriverStatusIndicator={getDriverStatusIndicator}
      getDriverActiveJobs={getDriverActiveJobs}
      getDriverMaxJobs={getDriverMaxJobs}
    />
  )
}

interface DispatchBoardContentProps {
  unassignedDeliveries: Delivery[]
  activeDeliveries: Delivery[]
  activeDrivers: Driver[]
  search: string
  setSearch: (s: string) => void
  driverFilter: string
  setDriverFilter: (s: string) => void
  assigningId: string | null
  handleAssign: (deliveryId: string, driverId: string) => void
  handleReassign: (deliveryId: string, newDriverId: string) => void
  getStatusColor: (status: DeliveryStatus) => string
  formatStatus: (status: string) => string
  getDriverStatusIndicator: (driver: Driver) => { color: string; text: string }
  getDriverActiveJobs: (driverId: string) => number
  getDriverMaxJobs: (driverId: string) => number
  disabled?: boolean
}

function DispatchBoardContent({
  unassignedDeliveries,
  activeDeliveries,
  activeDrivers,
  search,
  setSearch,
  driverFilter,
  setDriverFilter,
  assigningId,
  handleAssign,
  handleReassign,
  getStatusColor,
  formatStatus,
  getDriverStatusIndicator,
  getDriverActiveJobs,
  getDriverMaxJobs,
  disabled,
}: DispatchBoardContentProps) {
  return (
  <div className="space-y-6 overflow-x-hidden">
      {/* Top Row: Unassigned + Drivers */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Unassigned Jobs Column */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Package className="w-5 h-5 text-orange-500" />
                Unassigned Jobs
                <Badge variant="secondary" className="ml-2">
                  {unassignedDeliveries.length}
                </Badge>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            {unassignedDeliveries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>All jobs have been assigned</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {unassignedDeliveries.map(delivery => (
                  <div
                    key={delivery.id}
                    className={`border rounded-lg p-4 bg-card hover:bg-accent/50 transition-colors ${
                      delivery.isRush ? 'border-red-500/50 bg-red-500/5' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-medium truncate">
                            {delivery.businessName}
                          </span>
                          {delivery.isRush && (
                            <Badge className="bg-red-500 text-white shrink-0">
                              <Zap className="w-3 h-3 mr-1" />
                              RUSH
                            </Badge>
                          )}
                          {delivery.isOutOfTown && (
                            <Badge variant="outline" className="shrink-0">
                              <Globe className="w-3 h-3 mr-1" />
                              OOT
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mb-1">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate">{delivery.dropoffAddress}</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatDistanceToNow(new Date(delivery.postedAt), {
                              addSuffix: true,
                            })}
                          </span>
                          {delivery.calculatedRate && (
                            <span className="font-medium text-foreground">
                              ${delivery.calculatedRate.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Assign Dropdown */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild disabled={disabled}>
                          <Button
                            size="sm"
                            className="shrink-0"
                            disabled={assigningId === delivery.id || disabled}
                          >
                            {assigningId === delivery.id ? (
                              <Spinner className="w-4 h-4" />
                            ) : (
                              <>
                                <UserPlus className="w-4 h-4 mr-1" />
                                Assign
                                <ChevronDown className="w-3 h-3 ml-1" />
                              </>
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {activeDrivers
                            .filter(d => d.status !== 'off_duty')
                            .map(driver => {
                              const jobs = getDriverActiveJobs(driver.id)
                              const max = getDriverMaxJobs(driver.id)
                              const atCapacity = jobs >= max
                              return (
                                <DropdownMenuItem
                                  key={driver.id}
                                  onClick={() => handleAssign(delivery.id, driver.id)}
                                  className="flex items-center justify-between"
                                >
                                  <span className={atCapacity ? 'text-muted-foreground' : ''}>
                                    {driver.name}
                                  </span>
                                  <span
                                    className={`text-xs ${
                                      atCapacity
                                        ? 'text-orange-500'
                                        : 'text-muted-foreground'
                                    }`}
                                  >
                                    {jobs}/{max}
                                  </span>
                                </DropdownMenuItem>
                              )
                            })}
                          {activeDrivers.filter(d => d.status !== 'off_duty').length ===
                            0 && (
                            <DropdownMenuItem disabled>
                              No available drivers
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Drivers Column */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" />
              Drivers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {activeDrivers.map(driver => {
                const indicator = getDriverStatusIndicator(driver)
                const jobs = getDriverActiveJobs(driver.id)
                const max = getDriverMaxJobs(driver.id)
                return (
                  <div
                    key={driver.id}
                    className="flex items-center gap-3 p-3 border rounded-lg bg-card"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${indicator.color}`} />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{driver.name}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{indicator.text}</span>
                        <span>·</span>
                        <span>
                          {jobs}/{max} jobs
                        </span>
                      </div>
                    </div>
                    {driver.phone && (
                      <a
                        href={`tel:${driver.phone}`}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Phone className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Deliveries Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg flex items-center gap-2">
              <Truck className="w-5 h-5 text-green-500" />
              Active Deliveries
              <Badge variant="secondary" className="ml-2">
                {activeDeliveries.length}
              </Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 w-[200px]"
                  disabled={disabled}
                />
              </div>
              <Select value={driverFilter} onValueChange={setDriverFilter} disabled={disabled}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="All Drivers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Drivers</SelectItem>
                  {activeDrivers.map(d => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeDeliveries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No active deliveries</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="pb-3 font-medium">Driver</th>
                    <th className="pb-3 font-medium">Business</th>
                    <th className="pb-3 font-medium">Destination</th>
                    <th className="pb-3 font-medium">Status</th>
                    <th className="pb-3 font-medium">Time</th>
                    <th className="pb-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {activeDeliveries.map(delivery => (
                    <tr key={delivery.id} className="hover:bg-accent/50">
                      <td className="py-3">
                        <span className="font-medium">{delivery.driverName || '—'}</span>
                      </td>
                      <td className="py-3">
                        <span className="truncate max-w-[150px] block">
                          {delivery.businessName}
                        </span>
                      </td>
                      <td className="py-3">
                        <span className="truncate max-w-[200px] block text-muted-foreground">
                          {delivery.dropoffAddress}
                        </span>
                      </td>
                      <td className="py-3">
                        <Badge className={getStatusColor(delivery.status)}>
                          {formatStatus(delivery.status)}
                        </Badge>
                      </td>
                      <td className="py-3 text-muted-foreground">
                        {delivery.claimedAt
                          ? formatDistanceToNow(new Date(delivery.claimedAt), {
                              addSuffix: false,
                            })
                          : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild disabled={disabled}>
                            <Button variant="ghost" size="sm" disabled={disabled}>
                              <RefreshCw className="w-4 h-4 mr-1" />
                              Reassign
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {activeDrivers
                              .filter(
                                d => d.id !== delivery.driverId && d.status !== 'off_duty'
                              )
                              .map(driver => {
                                const jobs = getDriverActiveJobs(driver.id)
                                const max = getDriverMaxJobs(driver.id)
                                return (
                                  <DropdownMenuItem
                                    key={driver.id}
                                    onClick={() =>
                                      handleReassign(delivery.id, driver.id)
                                    }
                                    className="flex items-center justify-between"
                                  >
                                    <span>{driver.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                      {jobs}/{max}
                                    </span>
                                  </DropdownMenuItem>
                                )
                              })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
