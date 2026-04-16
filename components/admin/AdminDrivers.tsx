'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
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
} from 'lucide-react'
import { 
  getDrivers, 
  getDriverHistory, 
  createDriver,
  type DbDriver,
  type DbDelivery,
} from '@/lib/db'
import { createClient } from '@/lib/supabase/client'

export function AdminDrivers() {
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'performance'>('cards')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<DbDriver | null>(null)
  const [detailTab, setDetailTab] = useState('overview')

  // Fetch drivers from Supabase
  const { data: drivers = [], isLoading } = useSWR('all-drivers', getDrivers, {
    refreshInterval: 30000,
  })
  
  // Fetch selected driver's history
  const { data: driverHistory = [] } = useSWR(
    selectedDriver ? `driver-history-${selectedDriver.id}` : null,
    () => selectedDriver ? getDriverHistory(selectedDriver.id) : [],
  )

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
  })

  // Filter drivers
  const filteredDrivers = drivers.filter((d: DbDriver) => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
    return matchesSearch
  })

  const handleAddDriver = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Please fill in all fields')
      return
    }
    
    try {
      await createDriver({
        user_id: null,
        name: form.name,
        email: form.email,
        phone: form.phone,
        status: 'off_duty',
        max_jobs_override: null,
        total_deliveries: 0,
        today_deliveries: 0,
        month_deliveries: 0,
        avg_delivery_mins: null,
        rush_sla_rate: null,
        invite_status: 'pending',
      })
      
      // Refresh drivers list
      mutate('all-drivers')
      
      setForm({ name: '', email: '', phone: '' })
      setShowAddSheet(false)
      toast.success('Driver created successfully')
    } catch (error) {
      toast.error('Failed to create driver')
      console.error(error)
    }
  }

  const handleDeactivateDriver = async (driverId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({ invite_status: 'deactivated' })
      .eq('id', driverId)
    
    if (error) {
      toast.error('Failed to deactivate driver')
      return
    }
    
    mutate('all-drivers')
    toast.success('Driver deactivated')
    setSelectedDriver(null)
  }

  const handleReactivateDriver = async (driverId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({ invite_status: 'active' })
      .eq('id', driverId)
    
    if (error) {
      toast.error('Failed to reactivate driver')
      return
    }
    
    mutate('all-drivers')
    toast.success('Driver reactivated')
    setSelectedDriver(null)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
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

  const getRushSlaColor = (rate: number | null) => {
    if (rate === null) return 'text-muted-foreground'
    if (rate >= 90) return 'text-green-400'
    if (rate >= 70) return 'text-yellow-400'
    return 'text-red-400'
  }

  const formatAvgTime = (mins: number | null) => {
    if (mins === null) return '-'
    return `${mins}m`
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
            {filteredDrivers.map((driver: DbDriver) => (
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
                    <Badge className={inviteColors[driver.invite_status]} variant="outline">
                      {driver.invite_status}
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
                      <p className="text-lg font-bold text-foreground">{driver.today_deliveries}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{driver.month_deliveries}</p>
                      <p className="text-xs text-muted-foreground">Month</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${getRushSlaColor(driver.rush_sla_rate)}`}>
                        {driver.rush_sla_rate !== null ? `${driver.rush_sla_rate}%` : '-'}
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
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Today</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Month</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">All Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Avg Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rush SLA%</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver: DbDriver) => (
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
                    <td className="p-4 text-center">
                      <Badge variant="outline" className={statusColors[driver.status]}>
                        {driver.status === 'on_delivery' ? 'On Delivery' : 
                         driver.status === 'available' ? 'Available' : 'Off Duty'}
                      </Badge>
                    </td>
                    <td className="p-4 text-center text-foreground">{driver.today_deliveries}</td>
                    <td className="p-4 text-center text-foreground">{driver.month_deliveries}</td>
                    <td className="p-4 text-center text-foreground">{driver.total_deliveries}</td>
                    <td className="p-4 text-center text-muted-foreground">{formatAvgTime(driver.avg_delivery_mins)}</td>
                    <td className={`p-4 text-center font-medium ${getRushSlaColor(driver.rush_sla_rate)}`}>
                      {driver.rush_sla_rate !== null ? `${driver.rush_sla_rate}%` : '-'}
                    </td>
                  </tr>
                ))}
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
              Create Driver
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
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 py-4 border-b border-[var(--border-color)]">
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.today_deliveries}</p>
                  <p className="text-xs text-muted-foreground">Today</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.month_deliveries}</p>
                  <p className="text-xs text-muted-foreground">Month</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-foreground">{selectedDriver.total_deliveries}</p>
                  <p className="text-xs text-muted-foreground">All Time</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-muted-foreground">{formatAvgTime(selectedDriver.avg_delivery_mins)}</p>
                  <p className="text-xs text-muted-foreground">Avg</p>
                </div>
                <div className="text-center">
                  <p className={`text-lg font-bold ${getRushSlaColor(selectedDriver.rush_sla_rate)}`}>
                    {selectedDriver.rush_sla_rate !== null ? `${selectedDriver.rush_sla_rate}%` : '-'}
                  </p>
                  <p className="text-xs text-muted-foreground">SLA</p>
                </div>
              </div>
              
              {/* Performance Tabs */}
              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
                <TabsList className="w-full grid grid-cols-2 bg-[var(--bg-card-2)]">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="mt-4 space-y-4">
                  {/* Contact Info */}
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground">Contact Information</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedDriver.email}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-4 h-4 text-muted-foreground" />
                        <span>{selectedDriver.phone}</span>
                      </div>
                    </CardContent>
                  </Card>
                  
                  {/* Actions */}
                  <div className="pt-4 space-y-2">
                    {selectedDriver.invite_status === 'active' ? (
                      <Button 
                        variant="destructive" 
                        className="w-full"
                        onClick={() => handleDeactivateDriver(selectedDriver.id)}
                      >
                        Deactivate Driver
                      </Button>
                    ) : selectedDriver.invite_status === 'deactivated' ? (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleReactivateDriver(selectedDriver.id)}
                      >
                        Reactivate Driver
                      </Button>
                    ) : (
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        onClick={() => handleReactivateDriver(selectedDriver.id)}
                      >
                        Activate Driver
                      </Button>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="history" className="mt-4">
                  <div className="space-y-2">
                    {driverHistory.slice(0, 10).map((delivery: DbDelivery) => (
                      <div key={delivery.id} className="p-3 rounded-lg bg-[var(--bg-card-2)]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-foreground">
                            {delivery.business?.name || 'Unknown Business'}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {delivery.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{delivery.dropoff_area}</p>
                        {delivery.delivered_at && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(delivery.delivered_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    ))}
                    {driverHistory.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-8">No delivery history</p>
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
