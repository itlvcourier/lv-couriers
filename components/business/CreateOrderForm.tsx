'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  MapPin, 
  Package, 
  Clock, 
  DollarSign,
  AlertCircle,
  Truck,
  Copy,
  FilePlus,
  X,
} from 'lucide-react'
import type { ManifestItem, Delivery } from '@/lib/types'

interface CreateOrderFormProps {
  onSuccess?: () => void
}

type OrderPriority = 'scheduled' | 'normal' | 'express' | 'urgent'
type VehicleRequirement = 'any' | 'bike' | 'car' | 'van' | 'truck'

export function CreateOrderForm({ onSuccess }: CreateOrderFormProps) {
  const { currentUser, businesses, postDelivery, checkDuplicateAddress, combineDeliveries } = useApp()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [duplicateDelivery, setDuplicateDelivery] = useState<Delivery | null>(null)
  const [pendingManifest, setPendingManifest] = useState<ManifestItem[]>([])
  
  const business = businesses.find(b => b.id === currentUser?.businessId)
  const location = business?.locations.find(l => l.id === currentUser?.locationId)
  
  const [form, setForm] = useState({
    pickupAddress: location?.address || '',
    pickupContact: location?.phone || '',
    dropoffAddress: '',
    dropoffContact: '',
    packageDescription: '',
    packageWeight: '',
    priority: 'normal' as OrderPriority,
    vehicleRequirement: 'any' as VehicleRequirement,
    specialInstructions: '',
    requireSignature: false,
    requirePhoto: true,
    smallPackages: 0,
    bigPackages: 1,
    isRush: false,
    isOutOfTown: false,
  })

  const createManifestItems = (): ManifestItem[] => {
    const items: ManifestItem[] = []
    
    if (form.smallPackages > 0) {
      items.push({
        id: `item-${Date.now()}-small`,
        type: 'small_package',
        postedQty: form.smallPackages,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: form.packageDescription,
      })
    }
    
    if (form.bigPackages > 0) {
      items.push({
        id: `item-${Date.now()}-big`,
        type: 'big_package',
        postedQty: form.bigPackages,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: form.packageDescription,
      })
    }
    
    if (form.isRush) {
      items.push({
        id: `item-${Date.now()}-rush`,
        type: 'rush',
        postedQty: 1,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: '',
      })
    }
    
    if (form.isOutOfTown) {
      items.push({
        id: `item-${Date.now()}-oot`,
        type: 'out_of_town',
        postedQty: 1,
        confirmedQty: null,
        verificationPhotoUrl: null,
        notes: '',
      })
    }
    
    return items
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      // Validate required fields
      if (!form.pickupAddress || !form.dropoffAddress) {
        throw new Error('Please fill in all required fields')
      }
      
      if (form.smallPackages + form.bigPackages === 0) {
        throw new Error('Please add at least one package')
      }

      const manifest = createManifestItems()
      
      // Check for duplicate address
      const duplicate = checkDuplicateAddress(
        form.dropoffAddress, 
        currentUser?.businessId || '', 
        currentUser?.locationId || ''
      )
      
      if (duplicate) {
        // Show duplicate modal
        setDuplicateDelivery(duplicate)
        setPendingManifest(manifest)
        setShowDuplicateModal(true)
        setIsSubmitting(false)
        return
      }

      // No duplicate - post normally
      await postNewDelivery(manifest)

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const postNewDelivery = async (manifest: ManifestItem[]) => {
    postDelivery({
      businessId: currentUser?.businessId || '',
      locationId: currentUser?.locationId || '',
      businessName: business?.name || '',
      pickupAddress: form.pickupAddress,
      pickupArea: location?.name || '',
      dropoffAddress: form.dropoffAddress,
      dropoffArea: form.dropoffAddress.split(',')[1]?.trim() || 'Calgary',
      recipientPhone: form.dropoffContact || null,
      manifest,
      isUrgent: form.isRush || form.priority === 'urgent',
      isOutOfTown: form.isOutOfTown,
    })

    // Reset form
    setForm({
      pickupAddress: location?.address || '',
      pickupContact: location?.phone || '',
      dropoffAddress: '',
      dropoffContact: '',
      packageDescription: '',
      packageWeight: '',
      priority: 'normal',
      vehicleRequirement: 'any',
      specialInstructions: '',
      requireSignature: false,
      requirePhoto: true,
      smallPackages: 0,
      bigPackages: 1,
      isRush: false,
      isOutOfTown: false,
    })

    toast.success('Delivery posted successfully!')
    onSuccess?.()
  }
  
  const handleCombineWithExisting = () => {
    if (duplicateDelivery && pendingManifest.length > 0) {
      combineDeliveries(duplicateDelivery.id, pendingManifest)
      toast.success('Items added to existing delivery')
      setShowDuplicateModal(false)
      setDuplicateDelivery(null)
      setPendingManifest([])
      
      // Reset form
      setForm({
        pickupAddress: location?.address || '',
        pickupContact: location?.phone || '',
        dropoffAddress: '',
        dropoffContact: '',
        packageDescription: '',
        packageWeight: '',
        priority: 'normal',
        vehicleRequirement: 'any',
        specialInstructions: '',
        requireSignature: false,
        requirePhoto: true,
        smallPackages: 0,
        bigPackages: 1,
        isRush: false,
        isOutOfTown: false,
      })
      onSuccess?.()
    }
  }
  
  const handleKeepSeparate = async () => {
    setShowDuplicateModal(false)
    setDuplicateDelivery(null)
    await postNewDelivery(pendingManifest)
    setPendingManifest([])
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6 pb-8">
        <div>
          <h2 className="text-xl font-semibold mb-1">Create New Delivery</h2>
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
              <div className="w-6 h-6 rounded-full bg-green-500/10 flex items-center justify-center">
                <MapPin className="w-3.5 h-3.5 text-green-500" />
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
              <div className="w-6 h-6 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Package className="w-3.5 h-3.5 text-orange-500" />
              </div>
              Package Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smallPackages">Small Packages</Label>
                <Input
                  id="smallPackages"
                  type="number"
                  min="0"
                  value={form.smallPackages}
                  onChange={(e) => setForm({ ...form, smallPackages: parseInt(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bigPackages">Big Packages</Label>
                <Input
                  id="bigPackages"
                  type="number"
                  min="0"
                  value={form.bigPackages}
                  onChange={(e) => setForm({ ...form, bigPackages: parseInt(e.target.value) || 0 })}
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="packageDescription">Description</Label>
              <Input
                id="packageDescription"
                value={form.packageDescription}
                onChange={(e) => setForm({ ...form, packageDescription: e.target.value })}
                placeholder="e.g., Documents, Groceries, Medical supplies"
              />
            </div>

            <div className="flex flex-col gap-3 pt-2">
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="isRush"
                  checked={form.isRush}
                  onCheckedChange={(c) => setForm({ ...form, isRush: c === true })}
                />
                <Label htmlFor="isRush" className="text-sm font-normal cursor-pointer">
                  Rush delivery (45 min SLA)
                </Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox 
                  id="isOutOfTown"
                  checked={form.isOutOfTown}
                  onCheckedChange={(c) => setForm({ ...form, isOutOfTown: c === true })}
                />
                <Label htmlFor="isOutOfTown" className="text-sm font-normal cursor-pointer">
                  Out of town delivery
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Options */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-blue-500/10 flex items-center justify-center">
                <Clock className="w-3.5 h-3.5 text-blue-500" />
              </div>
              Delivery Options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
              Post Delivery
            </>
          )}
        </Button>
      </form>
      
      {/* Duplicate Address Modal */}
      <Dialog open={showDuplicateModal} onOpenChange={setShowDuplicateModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-orange-500" />
              Duplicate Address Found
            </DialogTitle>
            <DialogDescription>
              You already have a delivery going to this address today
            </DialogDescription>
          </DialogHeader>
          
          {duplicateDelivery && (
            <div className="space-y-4">
              {/* Existing delivery summary */}
              <Card className="bg-muted/50">
                <CardContent className="p-4">
                  <p className="font-medium text-sm mb-2">Existing Delivery</p>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{duplicateDelivery.businessName}</p>
                    <p>{duplicateDelivery.dropoffAddress}</p>
                    <p>Status: <span className="capitalize">{duplicateDelivery.status.replace('_', ' ')}</span></p>
                    {duplicateDelivery.driverName && (
                      <p>Driver: {duplicateDelivery.driverName}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
              
              {/* Options */}
              <div className="space-y-2">
                <Button
                  onClick={handleCombineWithExisting}
                  className="w-full h-12 justify-start px-4"
                  variant="outline"
                >
                  <Copy className="w-5 h-5 mr-3 text-green-500" />
                  <div className="text-left">
                    <p className="font-medium">Combine with existing delivery</p>
                    <p className="text-xs text-muted-foreground">Adds items, one billing</p>
                  </div>
                </Button>
                
                <Button
                  onClick={handleKeepSeparate}
                  className="w-full h-12 justify-start px-4"
                  variant="outline"
                >
                  <FilePlus className="w-5 h-5 mr-3 text-blue-500" />
                  <div className="text-left">
                    <p className="font-medium">Keep as separate delivery</p>
                    <p className="text-xs text-muted-foreground">Separate billing</p>
                  </div>
                </Button>
                
                <Button
                  onClick={() => {
                    setShowDuplicateModal(false)
                    setDuplicateDelivery(null)
                    setPendingManifest([])
                  }}
                  className="w-full h-12"
                  variant="ghost"
                >
                  <X className="w-4 h-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
