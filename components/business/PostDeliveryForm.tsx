'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

interface PostDeliveryFormProps {
  businessId: string
  businessAddress: string
  onSuccess?: () => void
}

export function PostDeliveryForm({ businessId, businessAddress, onSuccess }: PostDeliveryFormProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [form, setForm] = useState({
    pickup_address: businessAddress,
    dropoff_address: '',
    items_description: '',
    notes: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // TODO: API call to create delivery
      toast.success('Delivery posted successfully!')
      
      setForm({
        pickup_address: businessAddress,
        dropoff_address: '',
        items_description: '',
        notes: '',
      })
      
      onSuccess?.()
    } catch (err) {
      console.error(err)
      toast.error('Failed to post delivery')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Post New Delivery</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="pickup">Pickup Address</Label>
            <Input
              id="pickup"
              value={form.pickup_address}
              onChange={(e) => setForm({ ...form, pickup_address: e.target.value })}
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <Label htmlFor="dropoff">Dropoff Address</Label>
            <Input
              id="dropoff"
              value={form.dropoff_address}
              onChange={(e) => setForm({ ...form, dropoff_address: e.target.value })}
              placeholder="Enter destination address"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <Label htmlFor="items">What are you delivering?</Label>
            <Input
              id="items"
              value={form.items_description}
              onChange={(e) => setForm({ ...form, items_description: e.target.value })}
              placeholder="E.g., Documents, Package, Groceries"
              disabled={isLoading}
            />
          </div>

          <div>
            <Label htmlFor="notes">Additional Notes</Label>
            <Input
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Gate code, special instructions, etc"
              disabled={isLoading}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? 'Posting...' : 'Post Delivery'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
