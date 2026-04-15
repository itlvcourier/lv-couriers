'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { 
  Users, 
  Plus, 
  Phone, 
  Mail,
  Search,
  LayoutGrid,
  Table,
  X,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flag,
} from 'lucide-react'
import type { Driver, DriverMonthlyReport } from '@/lib/types'

export function AdminDrivers() {
  const { 
    drivers, 
    deliveries, 
    driverReports,
    addDriver, 
    deactivateDriver, 
    reactivateDriver,
    updateDriverCapacity,
    settings,
  } = useApp()
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'performance'>('cards')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)
  const [detailTab, setDetailTab] = useState('overview')

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
    return matchesSearch
  })

  const handleAddDriver = () => {
    if (!form.name || !form.email || !form.phone) return
    
    addDriver({
      name: form.name,
      email: form.email,
      phone: form.phone,
      status: 'available',
      maxJobsOverride: null,
      totalDeliveries: 0,
      todayDeliveries: 0,
      monthDeliveries: 0,
      averageTime: '-',
      rushSlaRate: 100,
      monthlyAdjustments: 0,
      inviteStatus: 'pending',
    })
    
    setForm({ name: '', email: '', phone: '' })
    setShowAddSheet(false)
    toast.success('Driver invite sent')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getDriverDeliveries = (driverId: string) => {
    return deliveries.filter(d => d.driverId === driverId)
  }

  const getDriverFlags = (driverId: string) => {
    return deliveries.filter(d => d.driverId === driverId && d.flags.length > 0)
  }
  
  const getDriverAdjustments = (driverId: string) => {
    return deliveries.filter(d => 
      d.driverId === driverId && 
      d.verifications.some(v => {
        const item = d.manifest.find(m => m.id === v.itemId)
        return item && v.confirmedQty !== item.postedQty
      })
    )
  }

  const statusColors: Record<string, string> = {
    available: 'bg-green-500/10 text-green-400 border-green-500/20',
    on_delivery: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    off_duty: 'bg-muted text-muted-foreground border-border',
  }

  const inviteColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    deactivated: 'bg-red-500/10 text-red-400',
  }

  const getRushSlaColor = (rate: number) => {
    if (rate >= 90) return 'text-green-400'
    if (rate >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const driverReport = selectedDriver 
    ? driverReports.find(r => r.driverId === selectedDriver.id)
    : null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-foreground">Drivers</h2>
          <p className="text-sm text-muted-foreground">{drivers.length} total drivers</p>
        </div>
        <div className="flex items-center gap-3">
          {/* View Toggle */}
          <div className="flex items-center rounded-lg border border-[var(--border-color)] p-1">
            <Button 
              variant={viewMode === 'cards' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 px-3"
            >
              <LayoutGrid className="w-4 h-4 mr-1" />
              Cards
            </Button>
            <Button 
              variant={viewMode === 'performance' ? 'secondary' : 'ghost'} 
              size="sm"
              onClick={() => setViewMode('performance')}
              className="h-8 px-3"
            >
              <Table className="w-4 h-4 mr-1" />
              Performance
            </Button>
          </div>
          <Button onClick={() => setShowAddSheet(true)} className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
            <Plus className="w-4 h-4" />
            Add Driver
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search drivers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
        />
      </div>

      {viewMode === 'cards' ? (
        // Cards View
        filteredDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1 text-foreground">No drivers found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver) => (
              <Card 
                key={driver.id} 
                className="bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                onClick={() => setSelectedDriver(driver)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                          {getInitials(driver.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">{driver.name}</h3>
                        <Badge variant="outline" className={statusColors[driver.status]}>
                          {driver.status === 'on_delivery' ? 'On Delivery' : 
                           driver.status === 'available' ? 'Available' : 'Off Duty'}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={inviteColors[driver.inviteStatus]} variant="outline">
                      {driver.inviteStatus}
                    </Badge>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{driver.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{driver.phone}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{driver.todayDeliveries}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{driver.monthDeliveries}</p>
                      <p className="text-xs text-muted-foreground">Month</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${getRushSlaColor(driver.rushSlaRate)}`}>
                        {driver.rushSlaRate}%
                      </p>
                      <p className="text-xs text-muted-foreground">Rush SLA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        // Performance Table View
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Driver</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Month</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">All Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Avg Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rush SLA%</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Adj</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Failed</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver) => {
                  const failed = deliveries.filter(d => 
                    d.driverId === driver.id && 
                    ['failed_permanent', 'failed_retry'].includes(d.status)
                  ).length
                  
                  return (
                    <tr 
                      key={driver.id} 
                      className="border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
                      onClick={() => setSelectedDriver(driver)}
                    >
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-xs">
                              {getInitials(driver.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium text-foreground">{driver.name}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center text-foreground">{driver.monthDeliveries}</td>
                      <td className="p-4 text-center text-foreground">{driver.totalDeliveries}</td>
                      <td className="p-4 text-center text-muted-foreground">{driver.averageTime}</td>
                      <td className={`p-4 text-center font-medium ${getRushSlaColor(driver.rushSlaRate)}`}>
                        {driver.rushSlaRate}%
                      </td>
                      <td className="p-4 text-center text-muted-foreground">{driver.monthlyAdjustments}</td>
                      <td className="p-4 text-center">
                        <span className={failed > 0 ? 'text-red-400' : 'text-muted-foreground'}>
                          {failed}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add Driver Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Add New Driver</SheetTitle>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="driver@lvcourier.ca"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="(403) 555-0100"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <Button 
              onClick={handleAddDriver} 
              className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Send Invite
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Driver Detail Panel */}
      <Sheet open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)] w-full sm:max-w-lg overflow-y-auto">
          {selectedDriver && (
            <>
              <SheetHeader className="pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-center gap-4">
                  <Avatar className="w-16 h-16">
                    <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-xl">
                      {getInitials(selectedDriver.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <SheetTitle className="text-foreground text-xl">{selectedDriver.name}</SheetTitle>
                    <Badge variant="outline" className={statusColors[selectedDriver.status]}>
                      {selectedDriver.status === 'on_delivery' ? 'On Delivery' : 
                       selectedDriver.status === 'available' ? 'Available' : 'Off Duty'}
                    </Badge>
                  </div>
                </div>
              </SheetHeader>
              
              {/* Stats Row */}
              <div className="grid grid-cols-5 gap-2 py-4 border-b border-[var(--border-color)]">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.todayDeliveries}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.monthDeliveries}</p>
                  <p className="text-xs text-muted-foreground">Month</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.totalDeliveries}</p>
                  <p className="text-xs text-muted-foreground">All Time</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-muted-foreground">{selectedDriver.averageTime}</p>
                  <p className="text-xs text-muted-foreground">Avg</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${getRushSlaColor(selectedDriver.rushSlaRate)}`}>
                    {selectedDriver.rushSlaRate}%
                  </p>
                  <p className="text-xs text-muted-foreground">SLA</p>
                </div>
              </div>
              
              {/* Performance Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
                <TabsList className="w-full grid grid-cols-4 bg-[var(--bg-card-2)]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="adjustments">Adj</TabsTrigger>
                  <TabsTrigger value="flags">Flags</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4 space-y-4">
                  {/* Weekly chart placeholder */}
                  {driverReport && (
                    <>
                      <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm text-foreground">Deliveries (Past 30 Days)</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-end justify-around h-24 gap-2">
                            {driverReport.weeklyBreakdown.map((count, i) => (
                              <div key={i} className="flex flex-col items-center gap-1">
                                <div 
                                  className="w-8 bg-[var(--accent-orange)] rounded-t"
                                  style={{ height: `${(count / Math.max(...driverReport.weeklyBreakdown)) * 80}px` }}
                                />
                                <span className="text-xs text-muted-foreground">W{i + 1}</span>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card-2)]">
                          <span className="text-sm text-muted-foreground">Top Customer</span>
                          <span className="text-sm font-medium text-foreground">FreshMart Shawnessy</span>
                        </div>
                        <div className="flex items-center justify-between p-3 rounded-lg bg-[var(--bg-card-2)]">
                          <span className="text-sm text-muted-foreground">Busiest Day</span>
                          <span className="text-sm font-medium text-foreground">Tuesdays</span>
                        </div>
                      </div>
                    </>
                  )}
                  
                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    {selectedDriver.inviteStatus === 'active' ? (
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => {
                          deactivateDriver(selectedDriver.id)
                          toast.success('Driver deactivated')
                          setSelectedDriver(null)
                        }}
                      >
                        Deactivate Driver
                      </Button>
                    ) : (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => {
                          reactivateDriver(selectedDriver.id)
                          toast.success('Driver reactivated')
                          setSelectedDriver(null)
                        }}
                      >
                        Reactivate Driver
                      </Button>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="history" className="mt-4">
                  <div className="space-y-2">
                    {getDriverDeliveries(selectedDriver.id).slice(0, 10).map((delivery) => (
                      <div key={delivery.id} className="p-3 rounded-lg bg-[var(--bg-card-2)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{delivery.businessName}</span>
                          <Badge variant="outline" className="text-xs">
                            {delivery.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{delivery.dropoffArea}</p>
                        {delivery.deliveredAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(delivery.deliveredAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                    {getDriverDeliveries(selectedDriver.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No delivery history</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="adjustments" className="mt-4">
                  <div className="space-y-2">
                    {getDriverAdjustments(selectedDriver.id).map((delivery) => (
                      <div key={delivery.id} className="p-3 rounded-lg bg-[var(--bg-card-2)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">{delivery.businessName}</span>
                          <span className="text-xs text-yellow-400">Qty Adjusted</span>
                        </div>
                        {delivery.verifications.map((v) => {
                          const item = delivery.manifest.find(m => m.id === v.itemId)
                          if (!item || v.confirmedQty === item.postedQty) return null
                          return (
                            <p key={v.itemId} className="text-xs text-muted-foreground">
                              {item.type}: Posted {item.postedQty} → Confirmed {v.confirmedQty}
                            </p>
                          )
                        })}
                      </div>
                    ))}
                    {getDriverAdjustments(selectedDriver.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No adjustments</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="flags" className="mt-4">
                  <div className="space-y-2">
                    {getDriverFlags(selectedDriver.id).map((delivery) => (
                      delivery.flags.map((flag) => (
                        <div key={flag.id} className="p-3 rounded-lg bg-[var(--bg-card-2)]">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-foreground">{delivery.businessName}</span>
                            <Badge variant="outline" className={flag.status === 'resolved' ? 'text-green-400' : 'text-yellow-400'}>
                              {flag.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{flag.type.replace('_', ' ')}</p>
                          <p className="text-xs text-muted-foreground mt-1">{flag.driverNote}</p>
                        </div>
                      ))
                    ))}
                    {getDriverFlags(selectedDriver.id).length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No flags raised</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
