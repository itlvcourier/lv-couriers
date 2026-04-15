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
  Building2, 
  Plus, 
  Phone, 
  Mail,
  MapPin,
  Search,
  Filter,
  Shield,
  MoreVertical,
  Edit,
  Trash2,
  Ban,
  Package,
  DollarSign
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { Business, BusinessType, BusinessStatus } from '@/lib/types'

export function AdminBusinesses() {
  const { businesses, orders, updateBusiness, deleteBusiness, addBusiness } = useApp()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<BusinessStatus | 'all'>('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<Business | null>(null)

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    businessType: 'restaurant' as BusinessType,
  })

  // Filter businesses
  const filteredBusinesses = businesses.filter(b => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.email.toLowerCase().includes(search.toLowerCase()) ||
      b.address.toLowerCase().includes(search.toLowerCase())
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddBusiness = () => {
    if (!form.name || !form.email || !form.address) return
    
    addBusiness({
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      businessType: form.businessType,
      isVerified: false,
      status: 'active',
    })
    
    setForm({ name: '', email: '', phone: '', address: '', businessType: 'restaurant' })
    setShowAddSheet(false)
  }

  const handleToggleVerified = (business: Business) => {
    updateBusiness(business.id, { isVerified: !business.isVerified })
  }

  const handleToggleStatus = (business: Business) => {
    updateBusiness(business.id, { 
      status: business.status === 'active' ? 'suspended' : 'active' 
    })
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getBusinessStats = (businessId: string) => {
    const businessOrders = orders.filter(o => o.businessId === businessId)
    const completed = businessOrders.filter(o => o.status === 'delivered').length
    const totalSpent = businessOrders
      .filter(o => o.status === 'delivered')
      .reduce((sum, o) => sum + o.price, 0)
    return { total: businessOrders.length, completed, totalSpent }
  }

  const statusColors: Record<BusinessStatus, string> = {
    active: 'bg-success/10 text-success border-success/20',
    inactive: 'bg-muted text-muted-foreground border-border',
    suspended: 'bg-destructive/10 text-destructive border-destructive/20',
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Businesses</h2>
          <p className="text-sm text-muted-foreground">{businesses.length} registered businesses</p>
        </div>
        <Button onClick={() => setShowAddSheet(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Business
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search businesses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as BusinessStatus | 'all')}>
          <SelectTrigger className="w-full sm:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
            <SelectItem value="suspended">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Businesses Grid */}
      {filteredBusinesses.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16">
          <Building2 className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-1">No businesses found</h3>
          <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredBusinesses.map((business) => {
            const stats = getBusinessStats(business.id)
            return (
              <Card key={business.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={business.avatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {getInitials(business.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{business.name}</h3>
                          {business.isVerified && (
                            <Shield className="w-4 h-4 text-success" />
                          )}
                        </div>
                        <Badge variant="outline" className={statusColors[business.status]}>
                          {business.status}
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
                        <DropdownMenuItem onClick={() => setSelectedBusiness(business)}>
                          <Edit className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleVerified(business)}>
                          <Shield className="w-4 h-4 mr-2" />
                          {business.isVerified ? 'Unverify' : 'Verify'}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleStatus(business)}>
                          <Ban className="w-4 h-4 mr-2" />
                          {business.status === 'active' ? 'Suspend' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem 
                          onClick={() => deleteBusiness(business.id)}
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
                      <Badge variant="secondary" className="text-xs capitalize">
                        {business.businessType}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{business.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-4 h-4" />
                      <span>{business.phone}</span>
                    </div>
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="w-4 h-4 mt-0.5" />
                      <span className="line-clamp-2">{business.address}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm">{stats.total} orders</span>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      ${stats.totalSpent.toFixed(0)} spent
                    </span>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* Add Business Sheet */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add New Business</SheetTitle>
            <SheetDescription>
              Enter the business details below
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>Business Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Acme Restaurant"
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="business@example.com"
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
              <Label>Address</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="123 Main St, Las Vegas, NV"
              />
            </div>
            <div className="space-y-2">
              <Label>Business Type</Label>
              <Select 
                value={form.businessType}
                onValueChange={(v) => setForm({ ...form, businessType: v as BusinessType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="restaurant">Restaurant</SelectItem>
                  <SelectItem value="retail">Retail</SelectItem>
                  <SelectItem value="pharmacy">Pharmacy</SelectItem>
                  <SelectItem value="grocery">Grocery</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddBusiness} className="w-full">
              <Plus className="w-4 h-4 mr-2" />
              Add Business
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Business Sheet */}
      <Sheet open={!!selectedBusiness} onOpenChange={() => setSelectedBusiness(null)}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Edit Business</SheetTitle>
            <SheetDescription>
              Update business information
            </SheetDescription>
          </SheetHeader>
          
          {selectedBusiness && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Business Name</Label>
                <Input
                  value={selectedBusiness.name}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={selectedBusiness.phone}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Address</Label>
                <Input
                  value={selectedBusiness.address}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, address: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Business Type</Label>
                <Select 
                  value={selectedBusiness.businessType}
                  onValueChange={(v) => setSelectedBusiness({ ...selectedBusiness, businessType: v as BusinessType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="restaurant">Restaurant</SelectItem>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="pharmacy">Pharmacy</SelectItem>
                    <SelectItem value="grocery">Grocery</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between py-2">
                <Label>Verified</Label>
                <Switch 
                  checked={selectedBusiness.isVerified}
                  onCheckedChange={(c) => setSelectedBusiness({ ...selectedBusiness, isVerified: c })}
                />
              </div>
              <Button 
                onClick={() => {
                  updateBusiness(selectedBusiness.id, selectedBusiness)
                  setSelectedBusiness(null)
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
