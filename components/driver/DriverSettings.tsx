'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  User, 
  Phone, 
  Mail, 
  Car, 
  Star,
  Shield,
  Bell,
  Moon,
  MapPin,
  LogOut,
  Package,
  DollarSign,
  Edit2,
  Check,
  X
} from 'lucide-react'

export function DriverSettings() {
  const router = useRouter()
  const { currentUser, drivers, deliveries, logout } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [editedPhone, setEditedPhone] = useState('')
  const [notifications, setNotifications] = useState(true)
  const [locationSharing, setLocationSharing] = useState(true)
  
  const driverId = currentUser?.driverId || ''
  const driver = drivers.find(d => d.id === driverId)

  // Calculate driver stats from deliveries
  const completedDeliveries = deliveries.filter(
    d => d.driverId === driverId && d.status === 'delivered'
  )
  const totalDeliveries = completedDeliveries.length
  
  // Calculate estimated earnings (based on completed deliveries with fixed rate)
  const baseRate = 8 // Base rate per delivery
  const rushBonus = 5 // Extra for rush deliveries
  const totalEarnings = completedDeliveries.reduce((sum, d) => {
    return sum + baseRate + (d.isUrgent ? rushBonus : 0)
  }, 0)
  
  // Average rating placeholder (would come from reviews)
  const avgRating = 4.8

  const handleSignOut = () => {
    logout()
    router.push('/login')
  }

  const handleStartEdit = () => {
    setEditedPhone(driver?.phone || '')
    setIsEditing(true)
  }

  const handleSaveProfile = () => {
    // In a real app, this would save to database
    toast.success('Profile updated')
    setIsEditing(false)
  }

  const handleCancelEdit = () => {
    setIsEditing(false)
    setEditedPhone('')
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  return (
    <div className="space-y-4 pb-20">
      {/* Profile Header */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)] overflow-hidden">
        <div className="h-16 bg-gradient-to-r from-[var(--accent-orange)]/20 via-[var(--accent-orange)]/10 to-transparent" />
        <CardContent className="relative pt-0 pb-6">
          <div className="flex flex-col items-center -mt-8">
            <div className="w-20 h-20 rounded-full bg-[var(--accent-orange)] flex items-center justify-center border-4 border-[var(--bg-card)] shadow-lg">
              <span className="text-xl font-semibold text-white">
                {getInitials(currentUser?.name || 'D')}
              </span>
            </div>
            <h2 className="mt-3 text-lg font-semibold text-foreground">{currentUser?.name}</h2>
            <div className="flex items-center gap-2 mt-2">
              <Badge className="bg-[var(--accent-green)]/10 text-[var(--accent-green)] border-[var(--accent-green)]/20">
                Online
              </Badge>
              <Badge variant="outline" className="border-[var(--accent-blue)] text-[var(--accent-blue)]">
                <Shield className="w-3 h-3 mr-1" />
                Verified
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 text-[var(--accent-orange)] mx-auto mb-2" />
            <p className="text-xl font-bold text-foreground">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4 text-center">
            <Package className="w-5 h-5 text-[var(--accent-blue)] mx-auto mb-2" />
            <p className="text-xl font-bold text-foreground">{totalDeliveries}</p>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-[var(--accent-green)] mx-auto mb-2" />
            <p className="text-xl font-bold text-foreground">${totalEarnings}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center justify-between">
            Contact Information
            {!isEditing ? (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={handleStartEdit}
                className="h-8 px-2 text-[var(--accent-blue)]"
              >
                <Edit2 className="w-4 h-4 mr-1" />
                Edit
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleCancelEdit}
                  className="h-8 px-2 text-muted-foreground"
                >
                  <X className="w-4 h-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleSaveProfile}
                  className="h-8 px-2 text-[var(--accent-green)]"
                >
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm text-foreground">{currentUser?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm text-foreground">{currentUser?.email}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center">
              <Phone className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Phone</p>
              {isEditing ? (
                <Input 
                  value={editedPhone}
                  onChange={(e) => setEditedPhone(e.target.value)}
                  className="h-8 mt-1 bg-[var(--bg-card-2)] border-[var(--border-color)]"
                  placeholder="Enter phone number"
                />
              ) : (
                <p className="text-sm text-foreground">{driver?.phone || 'Not set'}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[var(--bg-card-2)] flex items-center justify-center">
              <Car className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="text-sm text-foreground capitalize">
                {driver?.status?.replace('_', ' ') || 'Available'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <div>
                <span className="text-sm text-foreground">Push Notifications</span>
                <p className="text-xs text-muted-foreground">Get alerts for new jobs</p>
              </div>
            </div>
            <Switch 
              checked={notifications} 
              onCheckedChange={setNotifications}
              className="data-[state=checked]:bg-[var(--accent-orange)]"
            />
          </div>
          <Separator className="bg-[var(--border-color)]" />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <div>
                <span className="text-sm text-foreground">Location Sharing</span>
                <p className="text-xs text-muted-foreground">Share location during deliveries</p>
              </div>
            </div>
            <Switch 
              checked={locationSharing} 
              onCheckedChange={setLocationSharing}
              className="data-[state=checked]:bg-[var(--accent-orange)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Sign Out Button */}
      <Button 
        variant="outline" 
        className="w-full h-12 rounded-xl border-[var(--accent-red)] text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
        onClick={handleSignOut}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  )
}
