'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import type { RateCard, Business, BusinessLocation, RadiusPricingTier } from '@/lib/types'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AlertTriangle, Building2, Check, ChevronRight, DollarSign, FileText, X, MapPin, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { CostCalculator } from '@/components/shared/CostCalculator'
import { BillingScenarioTests } from './BillingScenarioTests'
import { saveRadiusTiers, getRadiusTiers } from '@/lib/db-extended'

export function AdminRateCards() {
  const { businesses, rateCards, saveRateCard, updateLocationEmails, updateLocationCoords } = useApp()
  const [selectedLocation, setSelectedLocation] = useState<{ business: Business; location: BusinessLocation } | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [testRateCardId, setTestRateCardId] = useState<string>('')
  const [businessFilter, setBusinessFilter] = useState<string>('all')

  // Get all locations with their rate card status
  const allLocations = businesses.flatMap(business =>
    business.locations.map(location => ({
      business,
      location,
      rateCard: rateCards.find(rc => rc.locationId === location.id) || null,
    }))
  )

  // Filter locations by selected business
  const filteredLocations = businessFilter === 'all' 
    ? allLocations 
    : allLocations.filter(l => l.business.id === businessFilter)

  const missingRateCards = allLocations.filter(l => !l.rateCard)

  const handleSelectLocation = (business: Business, location: BusinessLocation) => {
    setSelectedLocation({ business, location })
    setIsEditing(true)
  }

  return (
    <div className="space-y-6">
      {/* Warning Banner */}
      {missingRateCards.length > 0 && (
        <Card className="border-yellow-500/50 bg-yellow-500/10">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
            <p className="text-sm text-yellow-200">
              {missingRateCards.length} business{missingRateCards.length > 1 ? 'es have' : ' has'} no rate card and cannot post deliveries
            </p>
          </CardContent>
        </Card>
      )}

      {/* Business List */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Rate Cards</CardTitle>
              <CardDescription>Manage billing rates for each business location</CardDescription>
            </div>
            <Select value={businessFilter} onValueChange={setBusinessFilter}>
              <SelectTrigger className="w-[200px] bg-[var(--bg-card)] border-[var(--border-color)]">
                <SelectValue placeholder="Filter by business" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Businesses</SelectItem>
                {businesses.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border/50">
            {filteredLocations.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No locations found for the selected business
              </div>
            ) : (
              filteredLocations.map(({ business, location, rateCard }) => (
              <button
                key={location.id}
                onClick={() => handleSelectLocation(business, location)}
                className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium">{business.name}</p>
                    <p className="text-sm text-muted-foreground">{location.name} - {location.address}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {rateCard ? (
                    <Badge variant="outline" className="bg-green-500/10 text-green-400 border-green-500/20">
                      <Check className="h-3 w-3 mr-1" />
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      Missing
                    </Badge>
                  )}
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </button>
            ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Verification Tools */}
      {(() => {
        const rateCardOptions = allLocations
          .filter(l => l.rateCard)
          .map(l => ({
            id: l.rateCard!.id,
            label: `${l.business.name} — ${l.location.name}`,
            rateCard: l.rateCard as RateCard,
          }))
        const selectedId = testRateCardId || rateCardOptions[0]?.id || ''
        const selected = rateCardOptions.find(o => o.id === selectedId) || rateCardOptions[0]

        if (rateCardOptions.length === 0) return null

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="text-base font-semibold text-foreground">Billing Verification</h3>
                <p className="text-xs text-muted-foreground">
                  Test the live calculation logic against any store&apos;s rate card.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <label htmlFor="test-rate-card" className="text-xs text-muted-foreground">
                  Test against
                </label>
                <select
                  id="test-rate-card"
                  value={selectedId}
                  onChange={(e) => setTestRateCardId(e.target.value)}
                  className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card-2)] text-foreground text-sm px-3 py-2 min-h-[36px]"
                >
                  {rateCardOptions.map(opt => (
                    <option key={opt.id} value={opt.id}>{opt.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <CostCalculator
              rateCard={selected?.rateCard || null}
              rateCardLabel={selected?.label}
            />

            <BillingScenarioTests
              rateCard={selected?.rateCard || null}
              rateCardLabel={selected?.label}
            />
          </div>
        )
      })()}

      {/* Rate Card Editor Sheet */}
      <Sheet open={isEditing} onOpenChange={setIsEditing}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedLocation && (
            <RateCardEditor
              business={selectedLocation.business}
              location={selectedLocation.location}
              existingRateCard={rateCards.find(rc => rc.locationId === selectedLocation.location.id) || null}
              onSave={async (data, billingEmail, backupEmail, radiusTiers) => {
                // Save radius tiers to DB first if radius pricing is enabled
                let savedTiers: RadiusPricingTier[] = []
                if (data.useRadiusPricing && radiusTiers.length > 0) {
                  savedTiers = await saveRadiusTiers(selectedLocation.location.id, radiusTiers)
                } else if (!data.useRadiusPricing) {
                  // Clear tiers when disabled
                  await saveRadiusTiers(selectedLocation.location.id, [])
                }
                // Save rate card to rate_cards table (include tiers in local state)
                saveRateCard(selectedLocation.location.id, {
                  ...data,
                  radiusTiers: data.useRadiusPricing ? savedTiers : undefined,
                })
                // Save billing emails to business_locations table (separate from rate card)
                updateLocationEmails(selectedLocation.location.id, billingEmail, backupEmail || null)
                toast.success('Rate card and billing info saved successfully')
                setIsEditing(false)
              }}
              onClose={() => setIsEditing(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

interface RateCardEditorProps {
  business: Business
  location: BusinessLocation
  existingRateCard: RateCard | null
  onSave: (data: Partial<RateCard>, billingEmail: string, backupEmail: string, radiusTiers: RadiusTierInput[]) => void
  onClose: () => void
}

interface RadiusTierInput {
  maxDistanceKm: number
  rateRegular: number
  rateRush: number
  rateBigParcel: number
  rateRushBig: number
  label: string | null
  sortOrder?: number
}

function RateCardEditor({ business, location, existingRateCard, onSave, onClose }: RateCardEditorProps) {
  const { updateLocationCoords } = useApp()
  
  // Rate card fields (stored in rate_cards table)
  const [formData, setFormData] = useState({
    effectiveDate: existingRateCard?.effectiveDate || new Date().toISOString().split('T')[0],
    rateRegular: existingRateCard?.rateRegular ?? 9,
    rateBigDouble: existingRateCard?.rateBigDouble ?? 18,
    rateOotBig: existingRateCard?.rateOotBig ?? 0,
    rateRush: existingRateCard?.rateRush ?? 20,
    rateRushOot: existingRateCard?.rateRushOot ?? 30,
    gstApplicable: existingRateCard?.gstApplicable ?? true,
    cancelBeforeDepart: existingRateCard?.cancelBeforeDepart ?? 0,
    cancelEnRoute: existingRateCard?.cancelEnRoute ?? 5,
    contractNotes: existingRateCard?.contractNotes || '',
    useRadiusPricing: existingRateCard?.useRadiusPricing ?? false,
  })
  
  // Radius pricing tiers
  const [radiusTiers, setRadiusTiers] = useState<RadiusTierInput[]>([])
  const [loadingTiers, setLoadingTiers] = useState(false)
  
  // Load existing tiers when opening editor
  useEffect(() => {
    if (existingRateCard?.useRadiusPricing) {
      setLoadingTiers(true)
      getRadiusTiers(location.id).then(tiers => {
        if (tiers.length > 0) {
          setRadiusTiers(tiers.map(t => ({
            maxDistanceKm: t.maxDistanceKm,
            rateRegular: t.rateRegular,
            rateRush: t.rateRush,
            rateBigParcel: t.rateBigParcel,
            rateRushBig: t.rateRushBig,
            label: t.label || '',
          })))
        }
        setLoadingTiers(false)
      })
    }
  }, [existingRateCard?.useRadiusPricing, location.id])
  
  // Billing emails (stored in business_locations table, not rate_cards)
  const [billingEmail, setBillingEmail] = useState(location.billingEmail || '')
  const [backupEmail, setBackupEmail] = useState(location.backupEmail || '')

  const [errors, setErrors] = useState<string[]>([])

  const validate = () => {
    const newErrors: string[] = []
    
    // Validate flat rates only if not using distance-based pricing
    if (!formData.useRadiusPricing) {
      if (formData.rateRegular <= 0) newErrors.push('Regular delivery rate must be greater than $0')
      if (formData.rateBigDouble <= 0) newErrors.push('2+ big packages rate must be greater than $0')
      if (formData.rateRush <= 0) newErrors.push('Rush delivery rate must be greater than $0')
      if (formData.rateRushOot <= 0) newErrors.push('Rush + out of town rate must be greater than $0')
    }
    
    // Validate distance tiers if using distance-based pricing
    if (formData.useRadiusPricing) {
      if (radiusTiers.length === 0) {
        newErrors.push('At least one distance zone is required for distance-based pricing')
      }
      radiusTiers.forEach((tier, index) => {
        if (tier.maxDistanceKm <= 0) newErrors.push(`Zone ${index + 1}: Distance must be greater than 0`)
        if (tier.rateRegular <= 0) newErrors.push(`Zone ${index + 1}: Regular rate must be greater than $0`)
        if (tier.rateRush <= 0) newErrors.push(`Zone ${index + 1}: Rush rate must be greater than $0`)
      })
    }

    if (!billingEmail) newErrors.push('Primary billing email is required')

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSave = () => {
    if (validate()) {
      onSave(formData, billingEmail, backupEmail, radiusTiers)
    }
  }

  // Radius tier helpers
  const addTier = () => {
    const lastTier = radiusTiers[radiusTiers.length - 1]
    const newDistance = lastTier ? lastTier.maxDistanceKm + 5 : 5
    setRadiusTiers([...radiusTiers, {
      maxDistanceKm: newDistance,
      rateRegular: lastTier?.rateRegular ?? formData.rateRegular,
      rateRush: lastTier?.rateRush ?? formData.rateRush,
      rateBigParcel: lastTier?.rateBigParcel ?? formData.rateBigDouble,
      rateRushBig: lastTier?.rateRushBig ?? (formData.rateRush + 5),
      label: `Zone ${String.fromCharCode(65 + radiusTiers.length)}`, // A, B, C...
    }])
  }

  const removeTier = (index: number) => {
    setRadiusTiers(radiusTiers.filter((_, i) => i !== index))
  }

  const updateTier = (index: number, field: keyof RadiusTierInput, value: number | string | null) => {
    const updated = [...radiusTiers]
    updated[index] = { ...updated[index], [field]: value }
    setRadiusTiers(updated)
  }

  return (
    <div className="space-y-6">
      <SheetHeader>
        <SheetTitle>Rate Card - {business.name}</SheetTitle>
        <p className="text-sm text-muted-foreground">{location.name}</p>
      </SheetHeader>

      {/* Effective Date */}
      <div className="space-y-2">
        <Label>Effective from</Label>
        <Input
          type="date"
          value={formData.effectiveDate}
          onChange={(e) => setFormData({ ...formData, effectiveDate: e.target.value })}
        />
      </div>

      {/* Rate Fields */}
      <Card className={`bg-muted/30 ${formData.useRadiusPricing ? 'opacity-50' : ''}`}>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Flat Delivery Rates
            </CardTitle>
            {formData.useRadiusPricing && (
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                Disabled - Using Distance Pricing
              </span>
            )}
          </div>
          {!formData.useRadiusPricing && (
            <p className="text-xs text-muted-foreground mt-1">
              Fixed rates regardless of delivery distance
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <fieldset disabled={formData.useRadiusPricing}>
          <div className="grid gap-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Regular delivery</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rateRegular}
                  onChange={(e) => setFormData({ ...formData, rateRegular: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">2+ big packages</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rateBigDouble}
                  onChange={(e) => setFormData({ ...formData, rateBigDouble: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm">Out of town 2+ big</Label>
                {formData.rateOotBig === 0 && !formData.useRadiusPricing && (
                  <p className="text-xs text-yellow-400 mt-0.5">Rate not set - this scenario cannot be billed</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rateOotBig}
                  onChange={(e) => setFormData({ ...formData, rateOotBig: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Rush delivery</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rateRush}
                  onChange={(e) => setFormData({ ...formData, rateRush: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-sm">Rush + out of town</Label>
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.rateRushOot}
                  onChange={(e) => setFormData({ ...formData, rateRushOot: parseFloat(e.target.value) || 0 })}
                  className="w-24 text-right"
                />
              </div>
            </div>
          </div>
          </fieldset>
        </CardContent>
      </Card>

      {/* Radius-Based Pricing */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Distance-Based Pricing
            </CardTitle>
            <Switch
              checked={formData.useRadiusPricing}
              onCheckedChange={(checked) => {
                setFormData({ ...formData, useRadiusPricing: checked })
                if (checked && radiusTiers.length === 0) {
                  // Add default tiers when enabling
                  setRadiusTiers([
                    { maxDistanceKm: 5, rateRegular: formData.rateRegular, rateRush: formData.rateRush, rateBigParcel: formData.rateBigDouble, rateRushBig: formData.rateRush + 5, label: 'Zone A' },
                    { maxDistanceKm: 10, rateRegular: formData.rateRegular + 3, rateRush: formData.rateRush + 5, rateBigParcel: formData.rateBigDouble + 3, rateRushBig: formData.rateRush + 10, label: 'Zone B' },
                    { maxDistanceKm: 15, rateRegular: formData.rateRegular + 6, rateRush: formData.rateRush + 10, rateBigParcel: formData.rateBigDouble + 6, rateRushBig: formData.rateRush + 15, label: 'Zone C' },
                  ])
                }
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formData.useRadiusPricing 
              ? 'Rates are calculated based on driving distance from store'
              : 'Enable to charge different rates based on delivery distance'}
          </p>
        </CardHeader>
        
        {formData.useRadiusPricing && (
          <CardContent className="space-y-4">
            {!location.lat && (
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  <p className="text-xs text-yellow-400">
                    Store location not geocoded. Distance pricing requires store coordinates.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs h-7"
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/maps/geocode?address=${encodeURIComponent(location.address)}`)
                      if (res.ok) {
                        const data = await res.json()
                        if (data.lat && data.lng) {
                          updateLocationCoords(location.id, data.lat, data.lng)
                          toast.success('Location geocoded successfully!')
                        } else {
                          toast.error('Could not geocode address. Please check the address is correct.')
                        }
                      } else {
                        toast.error('Geocode API failed')
                      }
                    } catch (e) {
                      toast.error('Failed to geocode location')
                    }
                  }}
                >
                  <MapPin className="h-3 w-3 mr-1" />
                  Geocode Now
                </Button>
              </div>
            )}
            
            {loadingTiers ? (
              <div className="text-center py-4 text-muted-foreground text-sm">Loading zones...</div>
            ) : (
              <div className="space-y-3">
                {radiusTiers.map((tier, index) => (
                  <div key={index} className="p-3 rounded-lg bg-background/50 border border-border/50 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Input
                          value={tier.label ?? ''}
                          onChange={(e) => updateTier(index, 'label', e.target.value || null)}
                          className="w-20 h-8 text-sm font-medium"
                          placeholder="Zone A"
                        />
                        <span className="text-muted-foreground text-sm">up to</span>
                        <div className="flex items-center gap-1">
                          <Input
                            type="number"
                            step="0.5"
                            value={tier.maxDistanceKm}
                            onChange={(e) => updateTier(index, 'maxDistanceKm', parseFloat(e.target.value) || 0)}
                            className="w-16 h-8 text-sm text-center"
                          />
                          <span className="text-muted-foreground text-sm">km</span>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-red-400"
                        onClick={() => removeTier(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Regular</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={tier.rateRegular}
                            onChange={(e) => updateTier(index, 'rateRegular', parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-sm text-right"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Rush</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={tier.rateRush}
                            onChange={(e) => updateTier(index, 'rateRush', parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-sm text-right"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Big Parcel</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={tier.rateBigParcel}
                            onChange={(e) => updateTier(index, 'rateBigParcel', parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-sm text-right"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 p-2 rounded bg-muted/30">
                        <Label className="text-xs text-muted-foreground">Rush + Big</Label>
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground text-xs">$</span>
                          <Input
                            type="number"
                            step="0.5"
                            value={tier.rateRushBig}
                            onChange={(e) => updateTier(index, 'rateRushBig', parseFloat(e.target.value) || 0)}
                            className="w-16 h-7 text-sm text-right"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addTier}
                  className="w-full"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  Add Distance Zone
                </Button>
                
                <p className="text-xs text-muted-foreground">
                  Deliveries beyond the last zone use that zone&apos;s rates. 
                  Distance is calculated as driving distance from store to delivery address.
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* GST Toggle */}
      <div className="flex items-center justify-between">
        <Label>Apply GST 5%</Label>
        <Switch
          checked={formData.gstApplicable}
          onCheckedChange={(checked) => setFormData({ ...formData, gstApplicable: checked })}
        />
      </div>

      {/* Cancellation Fees */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Cancellation Fees</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">Before driver departs</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={formData.cancelBeforeDepart ?? 0}
                onChange={(e) => setFormData({ ...formData, cancelBeforeDepart: parseFloat(e.target.value) || 0 })}
                className="w-24 text-right"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm">En route to pickup</Label>
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground">$</span>
              <Input
                type="number"
                step="0.01"
                value={formData.cancelEnRoute ?? 0}
                onChange={(e) => setFormData({ ...formData, cancelEnRoute: parseFloat(e.target.value) || 0 })}
                className="w-24 text-right"
              />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">After pickup</Label>
            <span className="text-sm text-muted-foreground">Full rate</span>
          </div>
        </CardContent>
      </Card>

      {/* Billing Settings */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Billing Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Primary billing email</Label>
                <Input
                  type="email"
                  value={billingEmail}
                  onChange={(e) => setBillingEmail(e.target.value)}
                  placeholder="billing@company.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Backup billing email</Label>
                <Input
                  type="email"
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  placeholder="accounts@company.com"
                />
          </div>
          <div className="space-y-2">
            <Label>Contract notes</Label>
            <Textarea
              value={formData.contractNotes}
              onChange={(e) => setFormData({ ...formData, contractNotes: e.target.value })}
              placeholder="Special terms, discounts, etc."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Billing Logic Info */}
      <Card className="bg-blue-500/10 border-blue-500/20">
        <CardContent className="p-4">
          <p className="text-sm font-medium text-blue-400 mb-2">Priority Order:</p>
          <ol className="text-xs text-blue-300/80 space-y-1 list-decimal list-inside">
            {formData.useRadiusPricing ? (
              <>
                <li>Find distance zone based on driving distance</li>
                <li>Rush + big packages → Zone&apos;s Rush+Big rate</li>
                <li>Rush only → Zone&apos;s Rush rate</li>
                <li>2+ big packages → Zone&apos;s Big Parcel rate</li>
                <li>Regular → Zone&apos;s Regular rate</li>
              </>
            ) : (
              <>
                <li>Rush + out of town → Rush OOT rate</li>
                <li>Rush only → Rush rate</li>
                <li>2+ big packages + out of town → OOT big rate</li>
                <li>2+ big packages in town → 2+ big rate</li>
                <li>Everything else → Regular rate</li>
              </>
            )}
          </ol>
        </CardContent>
      </Card>

      {/* Errors */}
      {errors.length > 0 && (
        <Card className="bg-red-500/10 border-red-500/20">
          <CardContent className="p-4">
            <ul className="text-sm text-red-400 space-y-1">
              {errors.map((error, i) => (
                <li key={i}>• {error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4">
        <Button variant="outline" onClick={onClose} className="flex-1">
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={handleSave} className="flex-1">
          <Check className="h-4 w-4 mr-2" />
          Save Rate Card
        </Button>
      </div>
    </div>
  )
}
