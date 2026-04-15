'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { 
  User, 
  Phone, 
  Mail, 
  Car, 
  Star,
  MapPin,
  Shield,
  Bell,
  Moon,
  LogOut,
  ChevronRight,
  Package,
  DollarSign,
  Clock
} from 'lucide-react'
import type { Driver } from '@/lib/types'

export function DriverProfile() {
  const { currentUser, drivers, orders, logout, updateDriver } = useApp()
  const [isEditing, setIsEditing] = useState(false)
  const [editedPhone, setEditedPhone] = useState('')
  
  const driver = drivers.find(d => d.id === currentUser?.id) as Driver | undefined

  if (!driver) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-muted-foreground">Driver profile not found</p>
      </div>
    )
  }

  // Calculate stats
  const driverOrders = orders.filter(o => o.driverId === driver.id)
  const completedOrders = driverOrders.filter(o => o.status === 'delivered')
  const totalEarnings = completedOrders.reduce((sum, o) => sum + o.price, 0)
  const avgRating = completedOrders.length > 0
    ? completedOrders.reduce((sum, o) => sum + (o.rating || 5), 0) / completedOrders.length
    : 5

  const handleSaveProfile = () => {
    if (editedPhone) {
      updateDriver(driver.id, { phone: editedPhone })
    }
    setIsEditing(false)
  }

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase()
  }

  const getVehicleIcon = (type: string) => {
    switch (type) {
      case 'bike': return 'Bike'
      case 'car': return 'Car'
      case 'van': return 'Van'
      case 'truck': return 'Truck'
      default: return 'Vehicle'
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
              <AvatarImage src={driver.avatar} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {getInitials(driver.name)}
              </AvatarFallback>
            </Avatar>
            <h2 className="mt-4 text-xl font-semibold">{driver.name}</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={driver.status === 'available' ? 'default' : 'secondary'}>
                {driver.status === 'available' ? 'Online' : driver.status === 'busy' ? 'On Delivery' : 'Offline'}
              </Badge>
              {driver.isVerified && (
                <Badge variant="outline" className="border-success text-success">
                  <Shield className="w-3 h-3 mr-1" />
                  Verified
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Star className="w-5 h-5 text-warning mx-auto mb-2" />
            <p className="text-2xl font-bold">{avgRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground">Rating</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Package className="w-5 h-5 text-primary mx-auto mb-2" />
            <p className="text-2xl font-bold">{completedOrders.length}</p>
            <p className="text-xs text-muted-foreground">Deliveries</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <DollarSign className="w-5 h-5 text-success mx-auto mb-2" />
            <p className="text-2xl font-bold">${totalEarnings.toFixed(0)}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Contact Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            Contact Information
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => {
                if (isEditing) {
                  handleSaveProfile()
                } else {
                  setEditedPhone(driver.phone)
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
              <Mail className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm">{driver.email}</p>
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
                <p className="text-sm">{driver.phone}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
              <Car className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground">Vehicle</p>
              <p className="text-sm capitalize">{driver.vehicleType} - {driver.licensePlate}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Bell className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Push Notifications</span>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <Moon className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Dark Mode</span>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-3">
              <MapPin className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm">Share Location</span>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button 
        variant="destructive" 
        className="w-full"
        onClick={logout}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  )
}
