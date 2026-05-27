'use client'

import { useState, useMemo } from 'react'
import useSWR, { mutate } from 'swr'
import { toast } from 'sonner'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
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
  Users,
  BarChart3,
  ChevronRight,
  ArrowLeft,
  UserPlus,
  FileText,
  Settings,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'

type BusinessWithLocations = DbBusiness & { locations: DbLocation[] }

export function AdminBusinesses() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<DbBusiness['status'] | 'all'>('all')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedBusiness, setSelectedBusiness] = useState<BusinessWithLocations | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [detailBusiness, setDetailBusiness] = useState<BusinessWithLocations | null>(null)
  const [showAddLocationSheet, setShowAddLocationSheet] = useState(false)
  const [editingLocation, setEditingLocation] = useState<DbLocation | null>(null)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [locationToDelete, setLocationToDelete] = useState<DbLocation | null>(null)

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

  const [locationForm, setLocationForm] = useState({
    name: '',
    address: '',
    phone: '',
    billing_email: '',
    backup_email: '',
    notes: '',
  })

  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'manager' as 'owner' | 'manager' | 'viewer',
    locationIds: [] as string[],
  })
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; password: string } | null>(null)

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

  // Location management functions
  const handleAddLocation = async () => {
    if (!detailBusiness || !locationForm.name || !locationForm.address) {
      toast.error('Please fill in required fields')
      return
    }

    const supabase = createClient()
    const { error } = await supabase
      .from('business_locations')
      .insert({
        business_id: detailBusiness.id,
        name: locationForm.name,
        address: locationForm.address,
        phone: locationForm.phone || null,
        billing_email: locationForm.billing_email || detailBusiness.billing_email,
        backup_email: locationForm.backup_email || null,
        notes: locationForm.notes || null,
        is_active: true,
      })

    if (error) {
      toast.error('Failed to add location')
      console.error(error)
      return
    }

    mutate('all-businesses')
    setLocationForm({ name: '', address: '', phone: '', billing_email: '', backup_email: '', notes: '' })
    setShowAddLocationSheet(false)
    toast.success('Location added successfully')
  }

  const handleUpdateLocation = async () => {
    if (!editingLocation) return

    const supabase = createClient()
    const { error } = await supabase
      .from('business_locations')
      .update({
        name: editingLocation.name,
        address: editingLocation.address,
        phone: editingLocation.phone,
        billing_email: editingLocation.billing_email,
        backup_email: editingLocation.backup_email,
        notes: editingLocation.notes,
      })
      .eq('id', editingLocation.id)

    if (error) {
      toast.error('Failed to update location')
      return
    }

    mutate('all-businesses')
    setEditingLocation(null)
    toast.success('Location updated successfully')
  }

  const handleDeleteLocation = async (locationId: string) => {
    const supabase = createClient()
    const { error } = await supabase
      .from('business_locations')
      .delete()
      .eq('id', locationId)

    if (error) {
      toast.error('Failed to delete location - it may have deliveries')
      return
    }

    mutate('all-businesses')
    setLocationToDelete(null)
    toast.success('Location deleted')
  }

  const handleInviteUser = async () => {
    if (!detailBusiness || !inviteForm.email || !inviteForm.name || !inviteForm.password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (inviteForm.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (inviteForm.role !== 'owner' && inviteForm.locationIds.length === 0) {
      toast.error('Please select at least one location for non-owner users')
      return
    }

    setIsCreatingUser(true)

    try {
      const response = await fetch('/api/admin/create-business-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteForm.email,
          password: inviteForm.password,
          name: inviteForm.name,
          businessId: detailBusiness.id,
          locationId: inviteForm.role === 'owner' ? null : inviteForm.locationIds[0], // Primary location
          role: inviteForm.role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      // Show success with credentials
      setCreatedUserCredentials({ email: inviteForm.email, password: inviteForm.password })
      toast.success(`User account created for ${inviteForm.name}`)
      
      // Reset form but keep sheet open to show credentials
      setInviteForm({ email: '', name: '', password: '', role: 'manager', locationIds: [] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
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

  // Detailed Business View
  if (detailBusiness) {
    const businessStats = getBusinessStats(detailBusiness.id)
    
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={() => setDetailBusiness(null)}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3 flex-1">
            <Avatar className="w-12 h-12">
              <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                {getInitials(detailBusiness.name)}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{detailBusiness.name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusColors[detailBusiness.status]}>
                  {detailBusiness.status}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {detailBusiness.locations.length} location(s)
                </span>
              </div>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setSelectedBusiness(detailBusiness)}
          >
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{businessStats.total}</div>
              <div className="text-sm text-muted-foreground">Total Deliveries</div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-green-500">{businessStats.completed}</div>
              <div className="text-sm text-muted-foreground">Completed</div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">${businessStats.totalSpent.toFixed(0)}</div>
              <div className="text-sm text-muted-foreground">Total Billed</div>
            </CardContent>
          </Card>
          <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <CardContent className="p-4">
              <div className="text-2xl font-bold text-foreground">{detailBusiness.locations.length}</div>
              <div className="text-sm text-muted-foreground">Locations</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="locations" className="space-y-4">
          <TabsList className="bg-[var(--bg-card)] border border-[var(--border-color)]">
            <TabsTrigger value="locations" className="gap-2">
              <MapPin className="w-4 h-4" />
              Locations
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <Users className="w-4 h-4" />
              Team
            </TabsTrigger>
            <TabsTrigger value="billing" className="gap-2">
              <FileText className="w-4 h-4" />
              Billing
            </TabsTrigger>
          </TabsList>

          {/* Locations Tab */}
          <TabsContent value="locations" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Locations</h3>
              <Button 
                size="sm" 
                onClick={() => setShowAddLocationSheet(true)}
                className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
              >
                <Plus className="w-4 h-4" />
                Add Location
              </Button>
            </div>
            
            <div className="space-y-3">
              {detailBusiness.locations.map((location) => (
                <Card key={location.id} className="bg-[var(--bg-card)] border-[var(--border-color)]">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <h4 className="font-medium text-foreground">{location.name}</h4>
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <MapPin className="w-3 h-3" />
                          {location.address}
                        </p>
                        {location.phone && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Phone className="w-3 h-3" />
                            {location.phone}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground flex items-center gap-1">
                          <Mail className="w-3 h-3" />
                          {location.billing_email}
                        </p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditingLocation(location)}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Location
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => setLocationToDelete(location)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Location
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">Team Members</h3>
                <p className="text-sm text-muted-foreground">
                  Manage who can access this business
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={() => setShowInviteSheet(true)}
                className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
              >
                <UserPlus className="w-4 h-4" />
                Invite Member
              </Button>
            </div>
            
            {/* Role Hierarchy Info */}
            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <h4 className="text-sm font-medium text-blue-400 mb-2">User Roles</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p><strong className="text-foreground">Owner:</strong> Full access to all locations, can view combined reports, manage team</p>
                  <p><strong className="text-foreground">Manager:</strong> Can post deliveries and view reports for assigned locations only</p>
                  <p><strong className="text-foreground">Viewer:</strong> Read-only access to assigned locations (view orders, track deliveries)</p>
                </div>
              </CardContent>
            </Card>
            
            {/* Owner Card */}
            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(detailBusiness.contact_name || 'Owner')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="font-medium text-foreground">
                      {detailBusiness.contact_name || 'Business Owner'}
                    </div>
                    <div className="text-sm text-muted-foreground">{detailBusiness.billing_email}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className="bg-primary/10 text-primary border-primary/20">Owner</Badge>
                    <span className="text-xs text-muted-foreground">All {detailBusiness.locations.length} locations</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No additional team members</p>
              <p className="text-xs">Invite managers or viewers to grant access to specific locations</p>
            </div>
          </TabsContent>

          {/* Billing Tab */}
          <TabsContent value="billing" className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Billing Settings</h3>
            </div>
            
            <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Invoice Format</Label>
                  <Select 
                    value={detailBusiness.invoice_format}
                    onValueChange={async (v) => {
                      const supabase = createClient()
                      await supabase
                        .from('businesses')
                        .update({ invoice_format: v })
                        .eq('id', detailBusiness.id)
                      mutate('all-businesses')
                      setDetailBusiness({ ...detailBusiness, invoice_format: v as DbBusiness['invoice_format'] })
                      toast.success('Invoice format updated')
                    }}
                  >
                    <SelectTrigger className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="separate">
                        <div className="flex flex-col">
                          <span>Separate Invoices</span>
                          <span className="text-xs text-muted-foreground">One invoice per location</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="combined">
                        <div className="flex flex-col">
                          <span>Combined Invoice</span>
                          <span className="text-xs text-muted-foreground">All locations merged into one</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="combined_breakdown">
                        <div className="flex flex-col">
                          <span>Combined with Breakdown</span>
                          <span className="text-xs text-muted-foreground">One invoice showing each location</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    This determines how invoices are generated for multi-location businesses.
                  </p>
                </div>

                <div className="pt-4 border-t border-[var(--border-color)]">
                  <h4 className="font-medium text-foreground mb-3">Location Billing Emails</h4>
                  <div className="space-y-2">
                    {detailBusiness.locations.map((location) => (
                      <div key={location.id} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-card-2)]">
                        <div>
                          <div className="text-sm font-medium text-foreground">{location.name}</div>
                          <div className="text-xs text-muted-foreground">{location.billing_email}</div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => setEditingLocation(location)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add Location Sheet */}
        <Sheet open={showAddLocationSheet} onOpenChange={setShowAddLocationSheet}>
          <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
            <SheetHeader>
              <SheetTitle className="text-foreground">Add New Location</SheetTitle>
              <SheetDescription>
                Add a new location for {detailBusiness.name}
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">Location Name *</Label>
                <Input
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="Downtown Branch"
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Address *</Label>
                <Input
                  value={locationForm.address}
                  onChange={(e) => setLocationForm({ ...locationForm, address: e.target.value })}
                  placeholder="123 Main St, Calgary, AB"
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Phone</Label>
                <Input
                  value={locationForm.phone}
                  onChange={(e) => setLocationForm({ ...locationForm, phone: e.target.value })}
                  placeholder="(403) 555-0100"
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Billing Email</Label>
                <Input
                  type="email"
                  value={locationForm.billing_email}
                  onChange={(e) => setLocationForm({ ...locationForm, billing_email: e.target.value })}
                  placeholder={detailBusiness.billing_email}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
                <p className="text-xs text-muted-foreground">Leave blank to use business default</p>
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Backup Email</Label>
                <Input
                  type="email"
                  value={locationForm.backup_email}
                  onChange={(e) => setLocationForm({ ...locationForm, backup_email: e.target.value })}
                  placeholder="backup@company.com"
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Notes</Label>
                <Textarea
                  value={locationForm.notes}
                  onChange={(e) => setLocationForm({ ...locationForm, notes: e.target.value })}
                  placeholder="Special instructions for this location..."
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
              <Button onClick={handleAddLocation} className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
                <Plus className="w-4 h-4 mr-2" />
                Add Location
              </Button>
            </div>
          </SheetContent>
        </Sheet>

        {/* Edit Location Sheet */}
        <Sheet open={!!editingLocation} onOpenChange={() => setEditingLocation(null)}>
          <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
            <SheetHeader>
              <SheetTitle className="text-foreground">Edit Location</SheetTitle>
              <SheetDescription>
                Update location details
              </SheetDescription>
            </SheetHeader>
            
            {editingLocation && (
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Location Name</Label>
                  <Input
                    value={editingLocation.name}
                    onChange={(e) => setEditingLocation({ ...editingLocation, name: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Address</Label>
                  <Input
                    value={editingLocation.address}
                    onChange={(e) => setEditingLocation({ ...editingLocation, address: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Phone</Label>
                  <Input
                    value={editingLocation.phone || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, phone: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Billing Email</Label>
                  <Input
                    type="email"
                    value={editingLocation.billing_email}
                    onChange={(e) => setEditingLocation({ ...editingLocation, billing_email: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Backup Email</Label>
                  <Input
                    type="email"
                    value={editingLocation.backup_email || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, backup_email: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Notes</Label>
                  <Textarea
                    value={editingLocation.notes || ''}
                    onChange={(e) => setEditingLocation({ ...editingLocation, notes: e.target.value })}
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  />
                </div>
                <Button onClick={handleUpdateLocation} className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90">
                  Save Changes
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Invite Member Sheet */}
        <Sheet open={showInviteSheet} onOpenChange={(open) => {
          if (!open) {
            setCreatedUserCredentials(null)
            setInviteForm({ email: '', name: '', password: '', role: 'manager', locationIds: [] })
          }
          setShowInviteSheet(open)
        }}>
          <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
            <SheetHeader>
              <SheetTitle className="text-foreground">
                {createdUserCredentials ? 'User Created Successfully' : 'Create Store User'}
              </SheetTitle>
              <SheetDescription>
                {createdUserCredentials 
                  ? 'Share these credentials with the user. They can change their password after first login.'
                  : `Create a new user account for ${detailBusiness.name}`
                }
              </SheetDescription>
            </SheetHeader>
            
            {createdUserCredentials ? (
              // Show credentials after successful creation
              <div className="mt-6 space-y-4">
                <Card className="bg-green-500/10 border-green-500/30">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center gap-2 text-green-400">
                      <UserPlus className="w-5 h-5" />
                      <span className="font-medium">Account Created</span>
                    </div>
                    <div className="space-y-2">
                      <div>
                        <Label className="text-xs text-muted-foreground">Login Email</Label>
                        <p className="font-mono text-sm text-foreground bg-[var(--bg-card-2)] p-2 rounded">
                          {createdUserCredentials.email}
                        </p>
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                        <p className="font-mono text-sm text-foreground bg-[var(--bg-card-2)] p-2 rounded">
                          {createdUserCredentials.password}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <p className="text-xs text-muted-foreground">
                  The user can now log in at <strong>/business</strong> with these credentials.
                </p>
                <Button 
                  onClick={() => {
                    setCreatedUserCredentials(null)
                    setShowInviteSheet(false)
                  }} 
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            ) : (
              // Show creation form
              <div className="mt-6 space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Email *</Label>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="user@company.com"
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                    disabled={isCreatingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Name *</Label>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    placeholder="John Smith"
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                    disabled={isCreatingUser}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Temporary Password *</Label>
                  <Input
                    type="text"
                    value={inviteForm.password}
                    onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                    disabled={isCreatingUser}
                  />
                  <p className="text-xs text-muted-foreground">User should change this after first login</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Role</Label>
                  <Select 
                    value={inviteForm.role}
                    onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as 'owner' | 'manager' | 'viewer' })}
                    disabled={isCreatingUser}
                  >
                    <SelectTrigger className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="owner">Owner - Full access to all locations</SelectItem>
                      <SelectItem value="manager">Manager - Can post and manage deliveries</SelectItem>
                      <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {inviteForm.role !== 'owner' && (
                  <div className="space-y-2">
                    <Label className="text-foreground">Location Access *</Label>
                    <p className="text-xs text-muted-foreground mb-2">
                      Select which store(s) this user can access
                    </p>
                    <div className="space-y-2 max-h-40 overflow-y-auto border border-[var(--border-color)] rounded-lg p-2">
                      {detailBusiness.locations.map((location) => (
                        <div key={location.id} className="flex items-center gap-2 p-2 rounded hover:bg-[var(--bg-card-2)]">
                          <Checkbox
                            id={`loc-${location.id}`}
                            checked={inviteForm.locationIds.includes(location.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setInviteForm({ ...inviteForm, locationIds: [...inviteForm.locationIds, location.id] })
                              } else {
                                setInviteForm({ ...inviteForm, locationIds: inviteForm.locationIds.filter(id => id !== location.id) })
                              }
                            }}
                            disabled={isCreatingUser}
                          />
                          <Label htmlFor={`loc-${location.id}`} className="text-sm cursor-pointer flex-1">
                            {location.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                <Button 
                  onClick={handleInviteUser} 
                  className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
                  disabled={isCreatingUser}
                >
                  {isCreatingUser ? (
                    <>
                      <Spinner className="w-4 h-4 mr-2" />
                      Creating User...
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4 mr-2" />
                      Create User Account
                    </>
                  )}
                </Button>
              </div>
            )}
          </SheetContent>
        </Sheet>

        {/* Delete Location Confirmation */}
        <AlertDialog open={!!locationToDelete} onOpenChange={() => setLocationToDelete(null)}>
          <AlertDialogContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Delete Location</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{locationToDelete?.name}</strong>? 
                This action cannot be undone and may fail if the location has existing deliveries.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => locationToDelete && handleDeleteLocation(locationToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete Location
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
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
              <Card 
                key={business.id} 
                className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden cursor-pointer hover:border-[var(--accent-orange)]/50 transition-colors"
                onClick={() => setDetailBusiness(business)}
              >
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
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                        <DropdownMenuItem onClick={() => setDetailBusiness(business)}>
                          <ChevronRight className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
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
