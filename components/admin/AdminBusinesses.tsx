'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Spinner } from '@/components/ui/spinner'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import {
  Building2,
  Plus,
  Phone,
  Mail,
  MapPin,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Ban,
  Package,
  Trash2,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { getBusinesses, getAllDeliveries, type DbBusiness, type DbLocation, type DbDelivery } from '@/lib/db'
import { createClient } from '@/lib/supabase/client'

type BusinessWithLocations = DbBusiness & { locations: DbLocation[] }

export function AdminBusinesses() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DbBusiness['status'] | 'all'>('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithLocations | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch businesses from Supabase
  const { data: businesses = [], isLoading } = useSWR('all-businesses', getBusinesses, {
    refreshInterval: 30000,
  })

  // Fetch all deliveries for stats
  const { data: deliveries = [] } = useSWR('all-deliveries', () => getAllDeliveries(), {
    refreshInterval: 60000,
  })

  const [form, setForm] = useState({
    name: '',
    billing_email: '',
    contact_name: '',
    contact_phone: '',
  })

  // Filter businesses
  const filteredBusinesses = businesses.filter((b: BusinessWithLocations) => {
    const matchesSearch = b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.billing_email.toLowerCase().includes(search.toLowerCase()) ||
      (b.contact_name?.toLowerCase().includes(search.toLowerCase()))
    const matchesStatus = statusFilter === 'all' || b.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const handleAddBusiness = async () => {
    if (!form.name || !form.billing_email) {
      toast.error('Please fill in required fields')
      return
    }
    
    const supabase = createClient()
    const { error } = await supabase
      .from('businesses')
      .insert({
        name: form.name,
        billing_email: form.billing_email,
        contact_name: form.contact_name || null,
        contact_phone: form.contact_phone || null,
        invoice_format: 'combined',
        status: 'pending',
      })
    
    if (error) {
      toast.error('Failed to create business')
      console.error(error)
      return
    }
    
    mutate('all-businesses')
    setForm({ name: '', billing_email: '', contact_name: '', contact_phone: '' })
    setShowAddSheet(false)
    toast.success('Business created successfully')
  }

  const handleToggleStatus = async (business: BusinessWithLocations) => {
    const supabase = createClient()
    const newStatus = business.status === 'active' ? 'suspended' : 'active'
    
    const { error } = await supabase
      .from('businesses')
      .update({ status: newStatus })
      .eq('id', business.id)
    
    if (error) {
      toast.error('Failed to update status')
      return
    }
    
    mutate('all-businesses')
    toast.success(`Business ${newStatus === 'active' ? 'activated' : 'suspended'}`)
  }

  const handleDeleteBusiness = async () => {
    if (!selectedBusiness) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/businesses/${selectedBusiness.id}`, {
        method: 'DELETE',
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete business', { duration: 8000 })
        return
      }
      mutate('all-businesses')
      toast.success('Business permanently deleted')
      setShowDeleteConfirm(false)
      setSelectedBusiness(null)
    } catch {
      toast.error('Failed to delete business')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleUpdateBusiness = async () => {
    if (!selectedBusiness) return
    
    const supabase = createClient()
    const { error } = await supabase
      .from('businesses')
      .update({
        name: selectedBusiness.name,
        billing_email: selectedBusiness.billing_email,
        contact_name: selectedBusiness.contact_name,
        contact_phone: selectedBusiness.contact_phone,
        invoice_format: selectedBusiness.invoice_format,
      })
      .eq('id', selectedBusiness.id)
    
    if (error) {
      toast.error('Failed to update business')
      return
    }
    
    mutate('all-businesses')
    setSelectedBusiness(null)
    toast.success('Business updated successfully')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  const getBusinessStats = (businessId: string) => {
    const businessDeliveries = deliveries.filter((d: DbDelivery) => d.business_id === businessId)
    const completed = businessDeliveries.filter((d: DbDelivery) => d.status === 'delivered').length
    const totalSpent = businessDeliveries
      .filter((d: DbDelivery) => d.status === 'delivered' && d.total_amount)
      .reduce((sum: number, d: DbDelivery) => sum + (d.total_amount || 0), 0)
    return { total: businessDeliveries.length, completed, totalSpent }
  }

  const statusColors: Record<DbBusiness['status'], string> = {
    active: 'bg-green-500/10 text-green-400 border-green-500/20',
    pending: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    suspended: 'bg-red-500/10 text-red-400 border-red-500/20',
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
          <h2 className="text-xl font-semibold">Businesses</h2>
          <p className="text-sm text-muted-foreground">{businesses.length} registered businesses</p>
        </div>
        <Button onClick={() => setShowAddSheet(true)} className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
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
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as DbBusiness['status'] | 'all')}>
          <SelectTrigger className="w-full sm:w-40 bg-[var(--bg-card)] border-[var(--border-color)]">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
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
          {filteredBusinesses.map((business: BusinessWithLocations) => {
            const stats = getBusinessStats(business.id)
            return (
              <Card key={business.id} className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                          {getInitials(business.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">{business.name}</h3>
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
                        <DropdownMenuItem onClick={() => handleToggleStatus(business)}>
                          <Ban className="w-4 h-4 mr-2" />
                          {business.status === 'active' ? 'Suspend' : 'Activate'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            setSelectedBusiness(business)
                            setShowDeleteConfirm(true)
                          }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="space-y-2 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-4 h-4" />
                      <span className="truncate">{business.billing_email}</span>
                    </div>
                    {business.contact_phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{business.contact_phone}</span>
                      </div>
                    )}
                    {business.locations.length > 0 && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <MapPin className="w-4 h-4 mt-0.5" />
                        <span className="line-clamp-2">{business.locations[0].address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{business.locations.length} location(s)</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                    <div className="flex items-center gap-1">
                      <Package className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-foreground">{stats.total} deliveries</span>
                    </div>
                    <span className="text-sm font-medium text-primary">
                      ${stats.totalSpent.toFixed(0)} billed
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
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Add New Business</SheetTitle>
            <SheetDescription>
              Enter the business details below
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label className="text-foreground">Business Name *</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="FreshMart Groceries"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Billing Email *</Label>
              <Input
                type="email"
                value={form.billing_email}
                onChange={(e) => setForm({ ...form, billing_email: e.target.value })}
                placeholder="billing@freshmart.ca"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Contact Name</Label>
              <Input
                value={form.contact_name}
                onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                placeholder="John Smith"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Contact Phone</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
                placeholder="(403) 555-0100"
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <Button onClick={handleAddBusiness} className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
              <Plus className="w-4 h-4 mr-2" />
              Add Business
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Business Sheet */}
      <Sheet open={!!selectedBusiness} onOpenChange={() => setSelectedBusiness(null)}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Edit Business</SheetTitle>
            <SheetDescription>
              Update business information
            </SheetDescription>
          </SheetHeader>
          
          {selectedBusiness && (
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Business Name</Label>
                <Input
                  value={selectedBusiness.name}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, name: e.target.value })}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Billing Email</Label>
                <Input
                  type="email"
                  value={selectedBusiness.billing_email}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, billing_email: e.target.value })}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Name</Label>
                <Input
                  value={selectedBusiness.contact_name || ''}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, contact_name: e.target.value })}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Contact Phone</Label>
                <Input
                  value={selectedBusiness.contact_phone || ''}
                  onChange={(e) => setSelectedBusiness({ ...selectedBusiness, contact_phone: e.target.value })}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Invoice Format</Label>
                <Select 
                  value={selectedBusiness.invoice_format}
                  onValueChange={(v) => setSelectedBusiness({ ...selectedBusiness, invoice_format: v as DbBusiness['invoice_format'] })}
                >
                  <SelectTrigger className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="combined">Combined</SelectItem>
                    <SelectItem value="separate">Separate</SelectItem>
                    <SelectItem value="combined_breakdown">Combined with Breakdown</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleUpdateBusiness}
                className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
              >
                Save Changes
              </Button>

              <div className="pt-4 mt-2 border-t border-[var(--border-color)] space-y-2">
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  <Trash2 className="w-4 h-4" />
                  Delete Permanently
                </Button>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Suspend keeps the business and its history. Delete is only allowed for businesses with no deliveries or invoices.
                </p>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {selectedBusiness?.name} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the business, all its locations, rate cards, and saved
              contacts. It will fail if any deliveries or invoices exist for the
              business — suspend it instead to preserve records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteBusiness}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
