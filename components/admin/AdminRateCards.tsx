'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import type { RateCard, Business, BusinessLocation } from '@/lib/types'
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
import { AlertTriangle, Building2, Check, ChevronRight, DollarSign, FileText, X } from 'lucide-react'
import { toast } from 'sonner'
import { CostCalculator } from '@/components/shared/CostCalculator'
import { BillingScenarioTests } from './BillingScenarioTests'

export function AdminRateCards() {
  const { businesses, rateCards, saveRateCard, updateLocationEmails } = useApp()
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
              onSave={(data, billingEmail, backupEmail) => {
                // Save rate card to rate_cards table
                saveRateCard(selectedLocation.location.id, data)
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
  onSave: (data: Partial<RateCard>, billingEmail: string, backupEmail: string) => void
  onClose: () => void
}

function RateCardEditor({ business, location, existingRateCard, onSave, onClose }: RateCardEditorProps) {
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
  })
  
  // Billing emails (stored in business_locations table, not rate_cards)
  const [billingEmail, setBillingEmail] = useState(location.billingEmail || '')
  const [backupEmail, setBackupEmail] = useState(location.backupEmail || '')

  const [errors, setErrors] = useState<string[]>([])

  const validate = () => {
    const newErrors: string[] = []
    
    // Required rates cannot be $0 (except OOT big and cancellation fees)
    if (formData.rateRegular <= 0) newErrors.push('Regular delivery rate must be greater than $0')
    if (formData.rateBigDouble <= 0) newErrors.push('2+ big packages rate must be greater than $0')
    if (formData.rateRush <= 0) newErrors.push('Rush delivery rate must be greater than $0')
    if (formData.rateRushOot <= 0) newErrors.push('Rush + out of town rate must be greater than $0')
    
    // OOT big rate warning (can be 0 but show warning)
    if (formData.rateOotBig === 0) {
      // This is just a warning, not an error
    }

    if (!billingEmail) newErrors.push('Primary billing email is required')

    setErrors(newErrors)
    return newErrors.length === 0
  }

  const handleSave = () => {
    if (validate()) {
      onSave(formData, billingEmail, backupEmail)
    }
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
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Delivery Rates
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
                {formData.rateOotBig === 0 && (
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
        </CardContent>
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
            <li>Rush + out of town → Rush OOT rate</li>
            <li>Rush only → Rush rate</li>
            <li>2+ big packages + out of town → OOT big rate</li>
            <li>2+ big packages in town → 2+ big rate</li>
            <li>Everything else → Regular rate</li>
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
