'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  MapPin, 
  Package, 
  Clock, 
  DollarSign,
  AlertCircle,
  Truck
} from 'lucide-react'
import type { OrderPriority, VehicleRequirement } from '@/lib/types'

interface CreateOrderFormProps {
  onSuccess?: () => void
}

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const { createOrder, currentUser, businesses } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const business = businesses.find(b => b.id === currentUser?.id)
  
  const [form, setForm] = useState({
    pickupAddress: business?.address || '',
    pickupContact: business?.phone || '',
    dropoffAddress: '',
    dropoffContact: '',
    packageDescription: '',
    packageWeight: '',
    priority: 'normal' as OrderPriority,
    vehicleRequirement: 'any' as VehicleRequirement,
    specialInstructions: '',
    requireSignature: false,
    requirePhoto: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validate required fields
      if (!form.pickupAddress || !form.dropoffAddress || !form.packageDescription) {
        throw new Error('Please fill in all required fields')
      }

      // Calculate price based on priority and weight
      let basePrice = 15
      if (form.priority === 'express') basePrice = 25
      if (form.priority === 'urgent') basePrice = 40
      if (form.priority === 'scheduled') basePrice = 12
      
      const weight = parseFloat(form.packageWeight) || 1
      const weightFee = weight > 10 ? (weight - 10) * 0.5 : 0
      const price = basePrice + weightFee

      await createOrder({
        businessId: currentUser!.id,
        pickupAddress: form.pickupAddress,
        pickupContact: form.pickupContact,
        dropoffAddress: form.dropoffAddress,
        dropoffContact: form.dropoffContact,
        packageDescription: form.packageDescription,
        packageWeight: weight,
        priority: form.priority,
        vehicleRequirement: form.vehicleRequirement,
        specialInstructions: form.specialInstructions,
        requireSignature: form.requireSignature,
        requirePhoto: form.requirePhoto,
        price,
      })

      // Reset form
      setForm({
        pickupAddress: business?.address || '',
        pickupContact: business?.phone || '',
        dropoffAddress: '',
        dropoffContact: '',
        packageDescription: '',
        packageWeight: '',
        priority: 'normal',
        vehicleRequirement: 'any',
        specialInstructions: '',
        requireSignature: false,
        requirePhoto: true,
      })

      onSuccess?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-8">
      <div>
        <h2 className="text-xl font-semibold mb-1">Create New Order</h2>
        <p className="text-sm text-muted-foreground">Fill in the delivery details below</p>
      </div>

      {error && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Pickup Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-primary" />
            </div>
            Pickup Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pickupAddress">Pickup Address *</Label>
            <Input
              id="pickupAddress"
              value={form.pickupAddress}
              onChange={(e) => setForm({ ...form, pickupAddress: e.target.value })}
              placeholder="Enter pickup address"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pickupContact">Contact Phone</Label>
            <Input
              id="pickupContact"
              value={form.pickupContact}
              onChange={(e) => setForm({ ...form, pickupContact: e.target.value })}
              placeholder="Phone number at pickup"
            />
          </div>
        </CardContent>
      </Card>

      {/* Dropoff Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-success/10 flex items-center justify-center">
              <MapPin className="w-3.5 h-3.5 text-success" />
            </div>
            Delivery Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dropoffAddress">Delivery Address *</Label>
            <Input
              id="dropoffAddress"
              value={form.dropoffAddress}
              onChange={(e) => setForm({ ...form, dropoffAddress: e.target.value })}
              placeholder="Enter delivery address"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dropoffContact">Recipient Phone</Label>
            <Input
              id="dropoffContact"
              value={form.dropoffContact}
              onChange={(e) => setForm({ ...form, dropoffContact: e.target.value })}
              placeholder="Recipient phone number"
            />
          </div>
        </CardContent>
      </Card>

      {/* Package Details */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-warning/10 flex items-center justify-center">
              <Package className="w-3.5 h-3.5 text-warning" />
            </div>
            Package Details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="packageDescription">Package Description *</Label>
            <Input
              id="packageDescription"
              value={form.packageDescription}
              onChange={(e) => setForm({ ...form, packageDescription: e.target.value })}
              placeholder="e.g., Documents, Small box, Food order"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="packageWeight">Weight (lbs)</Label>
              <Input
                id="packageWeight"
                type="number"
                step="0.1"
                value={form.packageWeight}
                onChange={(e) => setForm({ ...form, packageWeight: e.target.value })}
                placeholder="0.0"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicleRequirement">Vehicle Type</Label>
              <Select 
                value={form.vehicleRequirement} 
                onValueChange={(v) => setForm({ ...form, vehicleRequirement: v as VehicleRequirement })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any Vehicle</SelectItem>
                  <SelectItem value="bike">Bike</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="truck">Truck</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Delivery Options */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-info/10 flex items-center justify-center">
              <Clock className="w-3.5 h-3.5 text-info" />
            </div>
            Delivery Options
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Priority Level</Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['scheduled', 'normal', 'express', 'urgent'] as OrderPriority[]).map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant={form.priority === p ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setForm({ ...form, priority: p })}
                  className="capitalize"
                >
                  {p}
                </Button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {form.priority === 'scheduled' && 'Flexible timing - lowest cost'}
              {form.priority === 'normal' && 'Standard delivery within 2-4 hours'}
              {form.priority === 'express' && 'Fast delivery within 1-2 hours'}
              {form.priority === 'urgent' && 'Immediate pickup and delivery'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="specialInstructions">Special Instructions</Label>
            <Textarea
              id="specialInstructions"
              value={form.specialInstructions}
              onChange={(e) => setForm({ ...form, specialInstructions: e.target.value })}
              placeholder="Gate codes, delivery instructions, handling notes..."
              rows={3}
            />
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <div className="flex items-center gap-3">
              <Checkbox 
                id="requireSignature"
                checked={form.requireSignature}
                onCheckedChange={(c) => setForm({ ...form, requireSignature: c === true })}
              />
              <Label htmlFor="requireSignature" className="text-sm font-normal cursor-pointer">
                Require signature on delivery
              </Label>
            </div>
            <div className="flex items-center gap-3">
              <Checkbox 
                id="requirePhoto"
                checked={form.requirePhoto}
                onCheckedChange={(c) => setForm({ ...form, requirePhoto: c === true })}
              />
              <Label htmlFor="requirePhoto" className="text-sm font-normal cursor-pointer">
                Require photo proof of delivery
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Price Estimate */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-primary" />
              <span className="font-medium">Estimated Cost</span>
            </div>
            <span className="text-2xl font-bold text-primary">
              ${(() => {
                let base = 15
                if (form.priority === 'express') base = 25
                if (form.priority === 'urgent') base = 40
                if (form.priority === 'scheduled') base = 12
                const weight = parseFloat(form.packageWeight) || 1
                const weightFee = weight > 10 ? (weight - 10) * 0.5 : 0
                return (base + weightFee).toFixed(2)
              })()}
            </span>
          </div>
        </CardContent>
      </Card>

      <Button 
        type="submit" 
        className="w-full h-12 text-base"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <>Creating Order...</>
        ) : (
          <>
            <Truck className="w-5 h-5 mr-2" />
            Create Delivery Order
          </>
        )}
      </Button>
    </form>
  )
}
