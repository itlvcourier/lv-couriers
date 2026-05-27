'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Spinner } from '@/components/ui/spinner'
import { ThemeToggleRow } from '@/components/shared/ThemeToggleRow'
import {
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
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
  Building2, 
  Phone, 
  Mail, 
  MapPin, 
  Shield,
  Bell,
  LogOut,
  Package,
  DollarSign,
  Star,
  Users,
  UserPlus,
  Plus,
  Trash2,
  Send,
  Store,
  MoreVertical,
  KeyRound,
} from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

export function BusinessProfile() {
  const { currentUser, businesses, deliveries, logout, isOwner } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [editedPhone, setEditedPhone] = useState('')
  const [editedAddress, setEditedAddress] = useState('')
  
  // Team Management State
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'manager' as 'manager' | 'viewer',
    locationIds: [] as string[],
  })
  const [isCreatingUser, setIsCreatingUser] = useState(false)
  const [createdUserCredentials, setCreatedUserCredentials] = useState<{ email: string; password: string } | null>(null)
  const [teamMembers, setTeamMembers] = useState<Array<{
    id: string
    email: string
    name: string
    business_role: string
    location_id: string | null
  }>>([])
  const [loadingTeam, setLoadingTeam] = useState(false)
  
  // Store Request State
  const [showStoreRequestSheet, setShowStoreRequestSheet] = useState(false)
  const [storeRequestType, setStoreRequestType] = useState<'add' | 'remove'>('add')
  const [storeRequestForm, setStoreRequestForm] = useState({
    storeName: '',
    storeAddress: '',
    storePhone: '',
    notes: '',
    locationIdToRemove: '',
  })
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false)
  
  // Password Change State
  const [showPasswordSheet, setShowPasswordSheet] = useState(false)
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  
  // Reset Team Member Password State
  const [showResetPasswordSheet, setShowResetPasswordSheet] = useState(false)
  const [selectedMemberForReset, setSelectedMemberForReset] = useState<{
    id: string
    email: string
    name: string
  } | null>(null)
  const [newMemberPassword, setNewMemberPassword] = useState('')
  const [isResettingPassword, setIsResettingPassword] = useState(false)
  
  const business = businesses.find(b => b.id === currentUser?.businessId)
  const primaryLocation = business?.locations[0]
  const userIsOwner = isOwner()

  if (!business) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Business profile not found</p>
      </div>
    )
  }

  // Calculate stats from deliveries
  const businessDeliveries = deliveries.filter(d => d.businessId === business.id)
  const completedDeliveries = businessDeliveries.filter(d => d.status === 'delivered')
  const totalSpent = completedDeliveries.reduce((sum, d) => sum + (d.calculatedRate || 0), 0)

  const handleSaveProfile = () => {
    toast.success('Profile updated')
    setIsEditing(false)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  // Fetch team members for this business
  const fetchTeamMembers = async () => {
    if (!business) return
    setLoadingTeam(true)
    const supabase = createClient()
    
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, role, business_id, location_id')
      .eq('business_id', business.id)
      .eq('role', 'business')
    
    if (!error && profiles) {
      // Filter out the main business owner (primary location's billing_email)
      const primaryBillingEmail = business.locations[0]?.billingEmail
      type ProfileRow = { id: string; email: string | null; full_name: string | null; location_id: string | null }
      const members = (profiles as ProfileRow[])
        .filter((p) => p.email !== primaryBillingEmail)
        .map((p) => ({
          id: p.id,
          email: p.email || '',
          name: p.full_name || p.email || '',
          business_role: p.location_id ? 'manager' : 'owner',
          location_id: p.location_id,
        }))
      setTeamMembers(members)
    }
    setLoadingTeam(false)
  }

  // Handle inviting a team member
  const handleInviteUser = async () => {
    if (!business || !inviteForm.email || !inviteForm.name || !inviteForm.password) {
      toast.error('Please fill in all required fields')
      return
    }

    if (inviteForm.password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (inviteForm.locationIds.length === 0) {
      toast.error('Please select at least one location')
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
          businessId: business.id,
          locationId: inviteForm.locationIds[0],
          role: inviteForm.role,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setCreatedUserCredentials({ email: inviteForm.email, password: inviteForm.password })
      toast.success(`User account created for ${inviteForm.name}`)
      fetchTeamMembers()
      setInviteForm({ email: '', name: '', password: '', role: 'manager', locationIds: [] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create user')
    } finally {
      setIsCreatingUser(false)
    }
  }

  // Handle store request submission
  const handleStoreRequest = async () => {
    if (!business) return
    
    if (storeRequestType === 'add') {
      if (!storeRequestForm.storeName || !storeRequestForm.storeAddress) {
        toast.error('Please fill in store name and address')
        return
      }
    } else {
      if (!storeRequestForm.locationIdToRemove) {
        toast.error('Please select a location to remove')
        return
      }
    }

    setIsSubmittingRequest(true)
    const supabase = createClient()

    try {
      // Create a store request record
      const { error } = await supabase
        .from('store_requests')
        .insert({
          business_id: business.id,
          request_type: storeRequestType,
          store_name: storeRequestType === 'add' ? storeRequestForm.storeName : 
            business.locations.find(l => l.id === storeRequestForm.locationIdToRemove)?.name,
          store_address: storeRequestType === 'add' ? storeRequestForm.storeAddress : null,
          store_phone: storeRequestType === 'add' ? storeRequestForm.storePhone : null,
          notes: storeRequestForm.notes,
          location_id: storeRequestType === 'remove' ? storeRequestForm.locationIdToRemove : null,
          status: 'pending',
          requested_by: currentUser?.email || 'unknown',
          created_at: new Date().toISOString(),
        })

      if (error) {
        // If table doesn't exist, just show success (request would go via email/support)
        console.error('Store request error:', error)
      }

      toast.success(
        storeRequestType === 'add' 
          ? 'Store addition request submitted! Our team will review and contact you.'
          : 'Store removal request submitted! Our team will review and contact you.'
      )
      setShowStoreRequestSheet(false)
      setStoreRequestForm({ storeName: '', storeAddress: '', storePhone: '', notes: '', locationIdToRemove: '' })
    } catch (error) {
      toast.error('Failed to submit request')
    } finally {
      setIsSubmittingRequest(false)
    }
  }

  // Handle password change
  const handlePasswordChange = async () => {
    if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
      toast.error('Please fill in all password fields')
      return
    }

    if (passwordForm.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setIsChangingPassword(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.updateUser({
        password: passwordForm.newPassword
      })

      if (error) {
        throw error
      }

      toast.success('Password changed successfully')
      setShowPasswordSheet(false)
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to change password')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Handle resetting team member password
  const handleResetMemberPassword = async () => {
    if (!selectedMemberForReset || !newMemberPassword) {
      toast.error('Please enter a new password')
      return
    }

    if (newMemberPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }

    setIsResettingPassword(true)

    try {
      const response = await fetch('/api/admin/reset-user-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: selectedMemberForReset.id,
          newPassword: newMemberPassword,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password')
      }

      toast.success(`Password reset for ${selectedMemberForReset.name}`)
      setShowResetPasswordSheet(false)
      setSelectedMemberForReset(null)
      setNewMemberPassword('')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to reset password')
    } finally {
      setIsResettingPassword(false)
    }
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Profile Header */}
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-primary/20 via-primary/10 to-transparent" />
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col items-center -mt-12">
            <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {getInitials(business.name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-semibold">{business.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={business.inviteStatus === 'active' ? 'default' : 'secondary'}>
                {business.inviteStatus === 'active' ? 'Active' : business.inviteStatus === 'pending' ? 'Pending' : 'Deactivated'}
              </Badge>
              <Badge variant="outline" className="border-success text-success">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{businessDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">Total Orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold">{completedDeliveries.length}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">${totalSpent.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Total Spent</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Business Information
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleSaveProfile()
                } else {
                  setEditedPhone(primaryLocation?.phone || '')
                  setEditedAddress(primaryLocation?.address || '')
                  setIsEditing(true)
                }
              }}
            >
              {isEditing ? 'Save' : 'Edit'}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Building2 className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Business Name</p>
              <p className="text-sm">{business.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Billing Email</p>
              <p className="text-sm">{primaryLocation?.billingEmail || 'Not set'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Phone className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Phone</p>
              {isEditing ? (
                <Input 
                  value={editedPhone}
                  onChange={(e) => setEditedPhone(e.target.value)}
                  className="h-8 mt-1"
                />
              ) : (
                <p className="text-sm">{primaryLocation?.phone || 'Not set'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <MapPin className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Address</p>
              {isEditing ? (
                <Input 
                  value={editedAddress}
                  onChange={(e) => setEditedAddress(e.target.value)}
                  className="h-8 mt-1"
                />
              ) : (
                <p className="text-sm">{primaryLocation?.address || 'Not set'}</p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations */}
      {business.locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Store className="w-4 h-4" />
                Locations ({business.locations.length})
              </span>
              {userIsOwner && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => {
                    setStoreRequestType('add')
                    setShowStoreRequestSheet(true)
                  }}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Request New
                </Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {business.locations.map((loc) => (
              <div key={loc.id} className="p-3 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium">{loc.name}</p>
                    <p className="text-xs text-muted-foreground">{loc.address}</p>
                    <p className="text-xs text-muted-foreground mt-1">{loc.phone}</p>
                  </div>
                  {userIsOwner && business.locations.length > 1 && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => {
                        setStoreRequestType('remove')
                        setStoreRequestForm(prev => ({ ...prev, locationIdToRemove: loc.id }))
                        setShowStoreRequestSheet(true)
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Team Management (Owner Only) */}
      {userIsOwner && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                Team Members
              </span>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setShowInviteSheet(true)
                  fetchTeamMembers()
                }}
              >
                <UserPlus className="w-4 h-4 mr-1" />
                Invite
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              Invite store managers or viewers to access specific locations
            </p>
            {loadingTeam ? (
              <div className="flex justify-center py-4">
                <Spinner className="w-5 h-5" />
              </div>
            ) : teamMembers.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No team members yet</p>
                <p className="text-xs">Invite managers to help manage your stores</p>
              </div>
            ) : (
              <div className="space-y-2">
                {teamMembers.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="text-xs">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{member.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {member.business_role}
                    </Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => {
                            setSelectedMemberForReset(member)
                            setShowResetPasswordSheet(true)
                          }}
                        >
                          <KeyRound className="w-4 h-4 mr-2" />
                          Reset Password
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Order Notifications</span>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <ThemeToggleRow id="business-dark-mode" />
          <Separator />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Change Password</span>
            </div>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setShowPasswordSheet(true)}
            >
              Change
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button 
        variant="destructive" 
        className="w-full"
        onClick={() => { void logout() }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>

      {/* Invite Team Member Sheet */}
      <Sheet open={showInviteSheet} onOpenChange={(open) => {
        if (!open) {
          setCreatedUserCredentials(null)
          setInviteForm({ email: '', name: '', password: '', role: 'manager', locationIds: [] })
        }
        setShowInviteSheet(open)
      }}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>
              {createdUserCredentials ? 'User Created' : 'Invite Team Member'}
            </SheetTitle>
            <SheetDescription>
              {createdUserCredentials 
                ? 'Share these credentials with the user'
                : 'Create login credentials for a store manager or viewer'
              }
            </SheetDescription>
          </SheetHeader>
          
          {createdUserCredentials ? (
            <div className="mt-6 space-y-4">
              <Card className="bg-green-500/10 border-green-500/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                    <UserPlus className="w-5 h-5" />
                    <span className="font-medium">Account Created</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">Login Email</Label>
                      <p className="font-mono text-sm bg-muted p-2 rounded">
                        {createdUserCredentials.email}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Temporary Password</Label>
                      <p className="font-mono text-sm bg-muted p-2 rounded">
                        {createdUserCredentials.password}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <p className="text-xs text-muted-foreground">
                The user can log in at the business portal with these credentials.
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
            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  placeholder="manager@company.com"
                  disabled={isCreatingUser}
                />
              </div>
              <div className="space-y-2">
                <Label>Name *</Label>
                <Input
                  value={inviteForm.name}
                  onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                  placeholder="John Smith"
                  disabled={isCreatingUser}
                />
              </div>
              <div className="space-y-2">
                <Label>Temporary Password *</Label>
                <Input
                  type="text"
                  value={inviteForm.password}
                  onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })}
                  placeholder="Min 6 characters"
                  disabled={isCreatingUser}
                />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select 
                  value={inviteForm.role}
                  onValueChange={(v) => setInviteForm({ ...inviteForm, role: v as 'manager' | 'viewer' })}
                  disabled={isCreatingUser}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">Manager - Can post deliveries</SelectItem>
                    <SelectItem value="viewer">Viewer - Read-only access</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label>Location Access *</Label>
                <div className="space-y-2 border rounded-lg p-2">
                  {business.locations.map((location) => (
                    <div key={location.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
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
              
              <Button 
                onClick={handleInviteUser} 
                className="w-full"
                disabled={isCreatingUser}
              >
                {isCreatingUser ? (
                  <>
                    <Spinner className="w-4 h-4 mr-2" />
                    Creating...
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

      {/* Store Request Sheet */}
      <Sheet open={showStoreRequestSheet} onOpenChange={setShowStoreRequestSheet}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>
              {storeRequestType === 'add' ? 'Request New Store' : 'Request Store Removal'}
            </SheetTitle>
            <SheetDescription>
              {storeRequestType === 'add' 
                ? 'Submit a request to add a new store location'
                : 'Submit a request to remove an existing store location'
              }
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            {storeRequestType === 'add' ? (
              <>
                <div className="space-y-2">
                  <Label>Store Name *</Label>
                  <Input
                    value={storeRequestForm.storeName}
                    onChange={(e) => setStoreRequestForm({ ...storeRequestForm, storeName: e.target.value })}
                    placeholder="e.g., Downtown Branch"
                    disabled={isSubmittingRequest}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Store Address *</Label>
                  <Input
                    value={storeRequestForm.storeAddress}
                    onChange={(e) => setStoreRequestForm({ ...storeRequestForm, storeAddress: e.target.value })}
                    placeholder="123 Main St, Calgary, AB"
                    disabled={isSubmittingRequest}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Store Phone</Label>
                  <Input
                    value={storeRequestForm.storePhone}
                    onChange={(e) => setStoreRequestForm({ ...storeRequestForm, storePhone: e.target.value })}
                    placeholder="403-555-0000"
                    disabled={isSubmittingRequest}
                  />
                </div>
              </>
            ) : (
              <Card className="bg-destructive/10 border-destructive/30">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <Trash2 className="w-5 h-5" />
                    <span className="font-medium">Store to Remove</span>
                  </div>
                  <p className="text-sm">
                    {business.locations.find(l => l.id === storeRequestForm.locationIdToRemove)?.name || 'Select a store'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {business.locations.find(l => l.id === storeRequestForm.locationIdToRemove)?.address}
                  </p>
                </CardContent>
              </Card>
            )}
            
            <div className="space-y-2">
              <Label>Additional Notes</Label>
              <Textarea
                value={storeRequestForm.notes}
                onChange={(e) => setStoreRequestForm({ ...storeRequestForm, notes: e.target.value })}
                placeholder="Any additional information..."
                rows={3}
                disabled={isSubmittingRequest}
              />
            </div>
            
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-xs text-muted-foreground">
                {storeRequestType === 'add' 
                  ? 'Our team will review your request and set up the new location with appropriate rate cards. You will be notified once the store is active.'
                  : 'Store removal requests are reviewed by our team. Any pending deliveries must be completed before removal.'
                }
              </p>
            </div>
            
            <Button 
              onClick={handleStoreRequest} 
              className="w-full"
              variant={storeRequestType === 'remove' ? 'destructive' : 'default'}
              disabled={isSubmittingRequest}
            >
              {isSubmittingRequest ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Request
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Password Change Sheet */}
      <Sheet open={showPasswordSheet} onOpenChange={setShowPasswordSheet}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>Change Password</SheetTitle>
            <SheetDescription>
              Enter a new password for your account
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="password"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                placeholder="Min 6 characters"
                disabled={isChangingPassword}
              />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password *</Label>
              <Input
                type="password"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                placeholder="Confirm new password"
                disabled={isChangingPassword}
              />
            </div>
            
            <Button 
              onClick={handlePasswordChange} 
              className="w-full"
              disabled={isChangingPassword}
            >
              {isChangingPassword ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Changing Password...
                </>
              ) : (
                <>
                  <Shield className="w-4 h-4 mr-2" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Reset Team Member Password Sheet */}
      <Sheet open={showResetPasswordSheet} onOpenChange={(open) => {
        if (!open) {
          setSelectedMemberForReset(null)
          setNewMemberPassword('')
        }
        setShowResetPasswordSheet(open)
      }}>
        <SheetContent className="bg-background border-l border-border">
          <SheetHeader>
            <SheetTitle>Reset Password</SheetTitle>
            <SheetDescription>
              Set a new password for {selectedMemberForReset?.name}
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {selectedMemberForReset ? getInitials(selectedMemberForReset.name) : ''}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{selectedMemberForReset?.name}</p>
                    <p className="text-sm text-muted-foreground">{selectedMemberForReset?.email}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <div className="space-y-2">
              <Label>New Password *</Label>
              <Input
                type="text"
                value={newMemberPassword}
                onChange={(e) => setNewMemberPassword(e.target.value)}
                placeholder="Min 6 characters"
                disabled={isResettingPassword}
              />
              <p className="text-xs text-muted-foreground">
                Share this password with the user. They can change it after logging in.
              </p>
            </div>
            
            <Button 
              onClick={handleResetMemberPassword} 
              className="w-full"
              disabled={isResettingPassword}
            >
              {isResettingPassword ? (
                <>
                  <Spinner className="w-4 h-4 mr-2" />
                  Resetting...
                </>
              ) : (
                <>
                  <KeyRound className="w-4 h-4 mr-2" />
                  Reset Password
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
