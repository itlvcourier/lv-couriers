'use client'

import { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Spinner } from '@/components/ui/spinner'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import { DollarSign, Zap, AlertTriangle, MapPin, Save } from 'lucide-react'
import { getSystemSettings, updateSystemSettings, type SystemSettings, defaultSettings } from '@/lib/settings'

export function DriverPaySettings() {
  const { data: settings, isLoading } = useSWR('system-settings', getSystemSettings)
  
  const [localSettings, setLocalSettings] = useState<SystemSettings>(defaultSettings)
  const [isSaving, setIsSaving] = useState(false)
  const [hasChanges, setHasChanges] = useState(false)
  
  useEffect(() => {
    if (settings) {
      setLocalSettings(settings)
    }
  }, [settings])
  
  const handleToggle = async (enabled: boolean) => {
    setLocalSettings(prev => ({ ...prev, driver_pay_enabled: enabled }))
    setHasChanges(true)
  }
  
  const handleRateChange = (field: keyof SystemSettings, value: string) => {
    const numValue = parseFloat(value) || 0
    setLocalSettings(prev => ({ ...prev, [field]: numValue }))
    setHasChanges(true)
  }
  
  const handleSave = async () => {
    setIsSaving(true)
    
    const result = await updateSystemSettings({
      driver_pay_enabled: localSettings.driver_pay_enabled,
      driver_base_rate: localSettings.driver_base_rate,
      driver_rush_bonus: localSettings.driver_rush_bonus,
      driver_urgent_bonus: localSettings.driver_urgent_bonus,
      driver_distance_rate: localSettings.driver_distance_rate,
    })
    
    if (result.success) {
      toast.success('Driver pay settings saved')
      mutate('system-settings')
      setHasChanges(false)
    } else {
      toast.error(result.error || 'Failed to save settings')
    }
    
    setIsSaving(false)
  }
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="w-6 h-6" />
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Main Toggle */}
      <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
            localSettings.driver_pay_enabled 
              ? 'bg-green-500/10 text-green-500' 
              : 'bg-muted text-muted-foreground'
          }`}>
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="font-medium text-foreground">Driver Pay System</p>
            <p className="text-sm text-muted-foreground">
              {localSettings.driver_pay_enabled 
                ? 'Automatic pay calculation is enabled' 
                : 'Manual pay mode - you handle driver payments'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={localSettings.driver_pay_enabled ? 'default' : 'secondary'}>
            {localSettings.driver_pay_enabled ? 'Active' : 'Inactive'}
          </Badge>
          <Switch
            checked={localSettings.driver_pay_enabled}
            onCheckedChange={handleToggle}
          />
        </div>
      </div>
      
      {/* Pay Rates Configuration - Only shown when enabled */}
      {localSettings.driver_pay_enabled && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <h4 className="font-medium text-foreground">Pay Rates</h4>
            
            {/* Base Rate */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-muted-foreground" />
                  Base Rate (per delivery)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={localSettings.driver_base_rate}
                    onChange={(e) => handleRateChange('driver_base_rate', e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Base amount paid for each completed delivery</p>
              </div>
              
              {/* Distance Rate */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  Distance Rate (per km)
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.10"
                    min="0"
                    value={localSettings.driver_distance_rate}
                    onChange={(e) => handleRateChange('driver_distance_rate', e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Additional pay per kilometer traveled</p>
              </div>
            </div>
            
            {/* Bonuses */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-yellow-500" />
                  Rush Delivery Bonus
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={localSettings.driver_rush_bonus}
                    onChange={(e) => handleRateChange('driver_rush_bonus', e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Extra pay for rush deliveries</p>
              </div>
              
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-red-500" />
                  Urgent Delivery Bonus
                </Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    type="number"
                    step="0.50"
                    min="0"
                    value={localSettings.driver_urgent_bonus}
                    onChange={(e) => handleRateChange('driver_urgent_bonus', e.target.value)}
                    className="pl-7"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Extra pay for urgent deliveries</p>
              </div>
            </div>
            
            {/* Example Calculation */}
            <Card className="bg-muted/30 border-dashed">
              <CardContent className="p-4">
                <p className="text-sm font-medium mb-2">Example Calculation</p>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Standard 10km delivery: ${(localSettings.driver_base_rate + (10 * localSettings.driver_distance_rate)).toFixed(2)}</p>
                  <p>Rush 10km delivery: ${(localSettings.driver_base_rate + localSettings.driver_rush_bonus + (10 * localSettings.driver_distance_rate)).toFixed(2)}</p>
                  <p>Urgent 10km delivery: ${(localSettings.driver_base_rate + localSettings.driver_urgent_bonus + (10 * localSettings.driver_distance_rate)).toFixed(2)}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </>
      )}
      
      {/* Save Button */}
      {hasChanges && (
        <div className="flex justify-end pt-4 border-t border-border">
          <Button 
            onClick={handleSave} 
            disabled={isSaving}
            className="bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
          >
            {isSaving ? (
              <>
                <Spinner className="w-4 h-4 mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  )
}
