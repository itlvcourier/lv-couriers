'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FieldGroup, Field, FieldLabel, FieldError } from '@/components/ui/field'
import { Spinner } from '@/components/ui/spinner'
import { 
  MapPin, 
  User, 
  Phone, 
  Package, 
  DollarSign,
  Zap,
  Send
} from 'lucide-react'
import { toast } from 'sonner'
import { createDelivery } from '@/lib/db'
import type { PackageSize, Priority, NewDeliveryForm } from '@/lib/types'

interface PostDeliveryFormProps {
  businessId: string
  businessAddress: string
  onSuccess?: () => void
}

export function PostDeliveryForm({ businessId, businessAddress, onSuccess }: PostDeliveryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const [form, setForm] = useState<NewDeliveryForm>({
    pickup_address: businessAddress,
    pickup_contact: '',
    pickup_phone: '',
    pickup_notes: '',
    dropoff_address: '',
    dropoff_contact: '',
    dropoff_phone: '',
    dropoff_notes: '',
    package_size: 'small',
    package_description: '',
    payout: 10,
    priority: 'standard',
  })

  const updateForm = (updates: Partial<NewDeliveryForm>) => {
    setForm(prev => ({ ...prev, ...updates }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!form.dropoff_address || !form.dropoff_contact) {
      setError('Please fill in all required fields')
      return
    }

    setIsLoading(true)

    try {
      await createDelivery(businessId, form)
      toast.success('Delivery posted successfully!')
      
      // Reset form
      setForm({
        pickup_address: businessAddress,
        pickup_contact: '',
        pickup_phone: '',
        pickup_notes: '',
        dropoff_address: '',
        dropoff_contact: '',
        dropoff_phone: '',
        dropoff_notes: '',
        package_size: 'small',
        package_description: '',
        payout: 10,
        priority: 'standard',
      })
      
      onSuccess?.()
    } catch (err) {
      console.error(err)
      setError('Failed to post delivery. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <h2 className="text-lg font-semibold">Post New Delivery</h2>

      {/* Pickup Details */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-green-500" />
            </div>
            Pickup Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Pickup Address</FieldLabel>
              <Input
                value={form.pickup_address}
                onChange={(e) => updateForm({ pickup_address: e.target.value })}
                placeholder="Pickup address"
                disabled={isLoading}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Contact Name</FieldLabel>
                <Input
                  value={form.pickup_contact}
                  onChange={(e) => updateForm({ pickup_contact: e.target.value })}
                  placeholder="Contact name"
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <Input
                  value={form.pickup_phone}
                  onChange={(e) => updateForm({ pickup_phone: e.target.value })}
                  placeholder="702-555-0100"
                  disabled={isLoading}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Pickup Notes (optional)</FieldLabel>
              <Textarea
                value={form.pickup_notes}
                onChange={(e) => updateForm({ pickup_notes: e.target.value })}
                placeholder="Any special instructions for pickup..."
                rows={2}
                disabled={isLoading}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Dropoff Details */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-red-500/10 flex items-center justify-center">
              <MapPin className="w-3 h-3 text-red-500" />
            </div>
            Dropoff Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel>Dropoff Address *</FieldLabel>
              <Input
                value={form.dropoff_address}
                onChange={(e) => updateForm({ dropoff_address: e.target.value })}
                placeholder="Full dropoff address"
                required
                disabled={isLoading}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Recipient Name *</FieldLabel>
                <Input
                  value={form.dropoff_contact}
                  onChange={(e) => updateForm({ dropoff_contact: e.target.value })}
                  placeholder="Recipient name"
                  required
                  disabled={isLoading}
                />
              </Field>
              <Field>
                <FieldLabel>Phone</FieldLabel>
                <Input
                  value={form.dropoff_phone}
                  onChange={(e) => updateForm({ dropoff_phone: e.target.value })}
                  placeholder="702-555-0100"
                  disabled={isLoading}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Delivery Notes (optional)</FieldLabel>
              <Textarea
                value={form.dropoff_notes}
                onChange={(e) => updateForm({ dropoff_notes: e.target.value })}
                placeholder="Gate code, apartment number, etc..."
                rows={2}
                disabled={isLoading}
              />
            </Field>
          </FieldGroup>
        </CardContent>
      </Card>

      {/* Package Details */}
      <Card className="border-border/50 bg-card/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            Package Details
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel>Package Size</FieldLabel>
                <Select 
                  value={form.package_size} 
                  onValueChange={(value: PackageSize) => updateForm({ package_size: value })}
                  disabled={isLoading}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="small">Small (Envelope)</SelectItem>
                    <SelectItem value="medium">Medium (Box)</SelectItem>
                    <SelectItem value="large">Large (Oversized)</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel>Driver Payout ($)</FieldLabel>
                <Input
                  type="number"
                  min="5"
                  step="0.50"
                  value={form.payout}
                  onChange={(e) => updateForm({ payout: parseFloat(e.target.value) || 0 })}
                  disabled={isLoading}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Package Description (optional)</FieldLabel>
              <Input
                value={form.package_description}
                onChange={(e) => updateForm({ package_description: e.target.value })}
                placeholder="What's in the package?"
                disabled={isLoading}
              />
            </Field>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-orange-500" />
                <div>
                  <p className="text-sm font-medium">Rush Delivery</p>
                  <p className="text-xs text-muted-foreground">Priority pickup and delivery</p>
                </div>
              </div>
              <Switch
                checked={form.priority === 'rush'}
                onCheckedChange={(checked) => updateForm({ priority: checked ? 'rush' : 'standard' })}
                disabled={isLoading}
              />
            </div>
          </FieldGroup>
        </CardContent>
      </Card>

      {error && (
        <FieldError className="text-center">{error}</FieldError>
      )}

      <Button type="submit" className="w-full h-12" disabled={isLoading}>
        {isLoading ? (
          <>
            <Spinner className="mr-2" />
            Posting...
          </>
        ) : (
          <>
            <Send className="w-4 h-4 mr-2" />
            Post Delivery (${form.payout.toFixed(2)} payout)
          </>
        )}
      </Button>
    </form>
  )
}
