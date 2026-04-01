'use client'
// Component: AdminDrivers - Manages driver list and invitations
import { useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Empty, EmptyMedia, EmptyTitle, EmptyDescription } from '@/components/ui/empty'
import { Spinner } from '@/components/ui/spinner'
import { 
  Sheet, 
  SheetContent, 
  SheetHeader, 
  SheetTitle,
  SheetDescription
} from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { 
  Users, 
  Plus, 
  Phone, 
  Mail,
  Car,
  Star,
  Copy,
  Check
} from 'lucide-react'
import { toast } from 'sonner'
import { getDrivers } from '@/lib/db'
import { inviteDriver } from '@/lib/server-auth'
import type { DbDriver, VehicleType } from '@/lib/types'

export function AdminDrivers() {
  const { data: drivers, error, isLoading, mutate } = useSWR('admin-drivers', getDrivers)
  const [showInviteSheet, setShowInviteSheet] = useState(false)
  const [isInviting, setIsInviting] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    phone: '',
    vehicle_type: 'car' as VehicleType,
  })

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsInviting(true)

    try {
      const result = await inviteDriver(
        inviteForm.email,
        inviteForm.name,
        inviteForm.phone,
        inviteForm.vehicle_type
      )

      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success('Driver invited successfully!')
        setTempPassword(result.tempPassword || null)
        mutate()
        if (!result.tempPassword) {
          setShowInviteSheet(false)
          setInviteForm({ name: '', email: '', phone: '', vehicle_type: 'car' })
        }
      }
    } catch (error) {
      toast.error('Failed to invite driver')
      console.error(error)
    } finally {
      setIsInviting(false)
    }
  }

  const copyCredentials = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(`Email: ${inviteForm.email}\nPassword: ${tempPassword}`)
      setCopied(true)
      toast.success('Credentials copied to clipboard')
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const closeInviteSheet = () => {
    setShowInviteSheet(false)
    setTempPassword(null)
    setInviteForm({ name: '', email: '', phone: '', vehicle_type: 'car' })
  }

  const statusColors = {
    available: 'bg-green-500/10 text-green-500 border-green-500/20',
    on_delivery: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
    offline: 'bg-muted text-muted-foreground border-border',
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  if (error) {
    return (
      <Empty>
        <EmptyMedia>
          <Users className="w-10 h-10" />
        </EmptyMedia>
        <EmptyTitle>Error loading drivers</EmptyTitle>
        <EmptyDescription>Please try refreshing the page</EmptyDescription>
      </Empty>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Drivers</h2>
        <Button onClick={() => setShowInviteSheet(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Invite Driver
        </Button>
      </div>

      {!drivers || drivers.length === 0 ? (
        <Empty>
          <EmptyMedia>
            <Users className="w-10 h-10" />
          </EmptyMedia>
          <EmptyTitle>No drivers yet</EmptyTitle>
          <EmptyDescription>Invite your first driver to get started</EmptyDescription>
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {drivers.map((driver) => (
            <Card key={driver.id} className="border-border/50 bg-card/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {driver.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium truncate">{driver.name}</h3>
                      <Badge variant="outline" className={statusColors[driver.status]}>
                        {driver.status === 'on_delivery' ? 'On Delivery' : 
                         driver.status === 'available' ? 'Available' : 'Offline'}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      {driver.email && (
                        <p className="flex items-center gap-1 truncate">
                          <Mail className="w-3 h-3 flex-shrink-0" />
                          {driver.email}
                        </p>
                      )}
                      {driver.phone && (
                        <p className="flex items-center gap-1">
                          <Phone className="w-3 h-3 flex-shrink-0" />
                          {driver.phone}
                        </p>
                      )}
                      <p className="flex items-center gap-1">
                        <Car className="w-3 h-3 flex-shrink-0" />
                        {driver.vehicle_type.charAt(0).toUpperCase() + driver.vehicle_type.slice(1)}
                      </p>
                    </div>
                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                        {driver.rating}
                      </span>
                      <span className="text-muted-foreground">
                        {driver.total_deliveries} deliveries
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Invite Driver Sheet */}
      <Sheet open={showInviteSheet} onOpenChange={closeInviteSheet}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Invite Driver</SheetTitle>
            <SheetDescription>
              Send an invitation to a new driver. They will receive login credentials.
            </SheetDescription>
          </SheetHeader>
          
          {tempPassword ? (
            <div className="mt-6 space-y-4">
              <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-medium text-green-500 mb-2">Driver invited successfully!</p>
                <p className="text-sm text-muted-foreground">
                  Share these credentials with the driver:
                </p>
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                <div>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="font-mono text-sm">{inviteForm.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Temporary Password</p>
                  <p className="font-mono text-sm">{tempPassword}</p>
                </div>
              </div>

              <Button onClick={copyCredentials} className="w-full gap-2">
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Credentials'}
              </Button>
              
              <Button variant="outline" onClick={closeInviteSheet} className="w-full">
                Done
              </Button>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="mt-6">
              <FieldGroup>
                <Field>
                  <FieldLabel>Full Name</FieldLabel>
                  <Input
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    placeholder="John Doe"
                    required
                    disabled={isInviting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Email</FieldLabel>
                  <Input
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    placeholder="driver@example.com"
                    required
                    disabled={isInviting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Phone Number</FieldLabel>
                  <Input
                    type="tel"
                    value={inviteForm.phone}
                    onChange={(e) => setInviteForm({ ...inviteForm, phone: e.target.value })}
                    placeholder="702-555-0100"
                    required
                    disabled={isInviting}
                  />
                </Field>
                <Field>
                  <FieldLabel>Vehicle Type</FieldLabel>
                  <Select 
                    value={inviteForm.vehicle_type}
                    onValueChange={(value: VehicleType) => setInviteForm({ ...inviteForm, vehicle_type: value })}
                    disabled={isInviting}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="car">Car</SelectItem>
                      <SelectItem value="van">Van</SelectItem>
                      <SelectItem value="bike">Bike</SelectItem>
                      <SelectItem value="truck">Truck</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Button type="submit" className="w-full" disabled={isInviting}>
                  {isInviting ? <Spinner className="mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  {isInviting ? 'Inviting...' : 'Send Invitation'}
                </Button>
              </FieldGroup>
            </form>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
