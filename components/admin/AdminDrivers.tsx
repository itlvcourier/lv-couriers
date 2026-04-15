'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Switch } from '@/components/ui/switch'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { 
  Users, 
  Plus, 
  Phone, 
  Mail,
  Car,
  Star,
  Search,
  Filter,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Ban
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Driver, VehicleType, DriverStatus } from '@/lib/types'

export function AdminDrivers() {
  const { drivers, orders, updateDriver, deleteDriver, addDriver } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DriverStatus | 'all'>('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<Driver | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicleType: 'car' as VehicleType,
    licensePlate: '',
  })

  // Filter drivers
  const filteredDrivers = drivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.email.toLowerCase().includes(search.toLowerCase()) ||
      d.phone.includes(search)
    const matchesStatus = statusFilter === 'all' || d.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddDriver = () => {
    if (!form.name || !form.email || !form.phone) return
    
    addDriver({
      name: form.name,
      email: form.email,
      phone: form.phone,
      vehicleType: form.vehicleType,
      licensePlate: form.licensePlate,
      isVerified: false,
      status: 'offline',
    })
    
    setForm({ name: '', email: '', phone: '', vehicleType: 'car', licensePlate: '' })
    setShowAddSheet(false)
  }

  const handleToggleVerified = (driver: Driver) => {
    updateDriver(driver.id, { isVerified: !driver.isVerified })
  }

  const handleToggleStatus = (driver: Driver, status: DriverStatus) => {
    updateDriver(driver.id, { status })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getDriverStats = (driverId: string) => {
    const driverOrders = orders.filter(o => o.driverId === driverId)
    const completed = driverOrders.filter(o => o.status === 'delivered').length
    const earnings = driverOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.price, 0)
    return { completed, earnings }
  }

  const statusColors: Record<DriverStatus, string> = {
    available: 'bg-success/10 text-success border-success/20',
    busy: 'bg-warning/10 text-warning border-warning/20',
    offline: 'bg-muted text-muted-foreground border-border',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Drivers</h2>
          <p className="text-sm text-muted-foreground">{drivers.length} total drivers</p>
        </div>
        <Button onClick={() => setShowAddSheet(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Driver
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search drivers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DriverStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="available">Available</SelectItem>
            <SelectItem value="busy">Busy</SelectItem>
            <SelectItem value="offline">Offline</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Drivers Grid */}
      {filteredDrivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No drivers found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredDrivers.map((driver) => {
            const stats = getDriverStats(driver.id)
            return (
              <Card key={driver.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={driver.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(driver.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{driver.name}</h3>
                          {driver.isVerified && (
                            <Shield className="w-4 h-4 text-success" />
                          )}
                        </div>
                        <Badge variant="outline" className={statusColors[driver.status]}>
                          {driver.status === 'busy' ? 'On Delivery' : 
                           driver.status === 'available' ? 'Available' : 'Offline'}
                        </Badge>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setSelectedDriver(driver)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleVerified(driver)}
                        >
                          <Shield className="w-4 h-4 mr-2" />
                          {driver.isVerified ? 'Unverify' : 'Verify'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => handleToggleStatus(driver, driver.status === 'offline' ? 'available' : 'offline')}
                        >
                          <Ban className="w-4 h-4 mr-2" />
                          {driver.status === 'offline' ? 'Activate' : 'Deactivate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteDriver(driver.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Car className="w-4 h-4" />
                      <span className="capitalize">{driver.vehicleType} - {driver.licensePlate}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-warning fill-warning" />
                      <span className="font-medium">{driver.rating.toFixed(1)}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {stats.completed} deliveries
                    </span>
                    <span className="text-sm font-medium text-success">
                      ${stats.earnings.toFixed(0)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Driver Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add New Driver</SheetTitle>
            <SheetDescription>
              Enter the driver details below
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="driver@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="702-555-0100"
              />
            </div>
            <div className="space-y-2">
              <Label>Vehicle Type</Label>
              <Select 
                value={form.vehicleType}
                onValueChange={(v) => setForm({ ...form, vehicleType: v as VehicleType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>License Plate</Label>
              <Input
                value={form.licensePlate}
                onChange={(e) => setForm({ ...form, licensePlate: e.target.value })}
                placeholder="ABC-1234"
              />
            </div>
            <Button onClick={handleAddDriver} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Driver
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Driver Sheet */}
      <Sheet open={!!selectedDriver} onOpenChange={() => setSelectedDriver(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Driver</SheetTitle>
            <SheetDescription>
              Update driver information
            </SheetDescription>
          </SheetHeader>
          
          {selectedDriver && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={selectedDriver.name}
                  onChange={(e) => setSelectedDriver({ ...selectedDriver, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={selectedDriver.phone}
                  onChange={(e) => setSelectedDriver({ ...selectedDriver, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Vehicle Type</Label>
                <Select 
                  value={selectedDriver.vehicleType}
                  onValueChange={(v) => setSelectedDriver({ ...selectedDriver, vehicleType: v as VehicleType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bike">Bike</SelectItem>
                    <SelectItem value="car">Car</SelectItem>
                    <SelectItem value="van">Van</SelectItem>
                    <SelectItem value="truck">Truck</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>License Plate</Label>
                <Input
                  value={selectedDriver.licensePlate}
                  onChange={(e) => setSelectedDriver({ ...selectedDriver, licensePlate: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Verified</Label>
                <Switch 
                  checked={selectedDriver.isVerified}
                  onCheckedChange={(c) => setSelectedDriver({ ...selectedDriver, isVerified: c })}
                />
              </div>
              <Button 
                onClick={() => {
                  updateDriver(selectedDriver.id, selectedDriver)
                  setSelectedDriver(null)
                }} 
                className="w-full"
              >
                Save Changes
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
