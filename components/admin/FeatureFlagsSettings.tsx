'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { Layers, Save, Truck, MapPin, Bell, ScanLine } from 'lucide-react'
import {
  type FeatureSettings,
  type OperatingMode,
  defaultFeatureSettings,
  getFeatureSettings,
  updateFeatureSettings,
  modePresets,
  detectOperatingMode,
} from '@/lib/feature-settings'
import { invalidateFeatureSettings } from '@/lib/hooks/useFeatureFlag'
import { saveSettingsToDb } from '@/lib/db-extended'

type BoolKey = {
  [K in keyof FeatureSettings]: FeatureSettings[K] extends boolean ? K : never
}[keyof FeatureSettings]

interface ToggleDef {
  key: BoolKey
  label: string
  description: string
}

interface ToggleGroup {
  title: string
  icon: React.ReactNode
  toggles: ToggleDef[]
}

const GROUPS: ToggleGroup[] = [
  {
    title: 'Routing & Zones',
    icon: <MapPin className="w-4 h-4" />,
    toggles: [
      { key: 'zones_enabled', label: 'Zones', description: 'Auto-resolve pickup/dropoff zones and assign zone drivers.' },
      { key: 'auto_assign_driver', label: 'Auto-assign driver', description: 'Assign the zone driver automatically at order creation.' },
      { key: 'consolidation_enabled', label: 'Hub consolidation', description: 'Route cross-zone parcels through the hub for sorting.' },
      { key: 'route_optimization_enabled', label: 'Route optimization', description: 'Optimize multi-stop driver routes (Routes API).' },
    ],
  },
  {
    title: 'Intake & Cutoff',
    icon: <Truck className="w-4 h-4" />,
    toggles: [
      { key: 'cutoff_enabled', label: 'Daily cutoff', description: 'Enforce per-business cutoff times for same-day dispatch.' },
      { key: 'late_requests_enabled', label: 'Late requests', description: 'Allow post-cutoff requests into the approval queue.' },
    ],
  },
  {
    title: 'Transfers',
    icon: <Truck className="w-4 h-4" />,
    toggles: [
      { key: 'driver_transfers_enabled', label: 'Driver-to-driver transfers', description: 'Allow drivers to hand off parcels to each other.' },
      { key: 'transfer_requires_admin', label: 'Transfers require admin', description: 'Admin must approve every driver transfer.' },
    ],
  },
  {
    title: 'Address Intelligence',
    icon: <MapPin className="w-4 h-4" />,
    toggles: [
      { key: 'driver_address_change_requires_approval', label: 'Address-change approval', description: 'Driver address edits go to the approval queue.' },
      { key: 'inbound_sms_address_capture', label: 'Inbound SMS capture', description: 'Capture recipient address replies via SMS.' },
    ],
  },
  {
    title: 'Tracking & Proof',
    icon: <Bell className="w-4 h-4" />,
    toggles: [
      { key: 'auto_geofence_events', label: 'Auto geofence events', description: 'Emit custody events automatically on arrival/departure.' },
      { key: 'barcode_scanning_required', label: 'Scanning required', description: 'Require a QR/barcode scan for custody changes.' },
      { key: 'proof_of_delivery_required', label: 'Proof of delivery', description: 'Require photo/signature at delivery.' },
      { key: 'recipient_live_tracking_enabled', label: 'Recipient live tracking', description: 'Share a live tracking link with recipients.' },
    ],
  },
]

export function FeatureFlagsSettings() {
  const [settings, setSettings] = useState<FeatureSettings>(defaultFeatureSettings)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    let active = true
    getFeatureSettings()
      .then((s) => {
        if (active) setSettings(s)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const currentMode = detectOperatingMode(settings)

  const setBool = (key: BoolKey, value: boolean) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const applyPreset = (mode: OperatingMode) => {
    setSettings((prev) => ({ ...prev, ...modePresets[mode] }))
    setDirty(true)
    toast.message(`${mode === 'cross_dock' ? 'Cross-dock' : 'Direct'} preset applied`, {
      description: 'Review the toggles and save to confirm.',
    })
  }

  const handleSave = async () => {
    setSaving(true)
    const result = await updateFeatureSettings(settings)
    // Direct mode has no zones, so zone-based auto-assign can't place jobs.
    // Enable driver self-claim so posted pickups still reach drivers as an open
    // pool (admins can also assign directly from the dispatch board).
    if (result.success && detectOperatingMode(settings) === 'direct') {
      await saveSettingsToDb({ allowDriverSelfClaim: true }).catch(() => {})
    }
    setSaving(false)
    if (result.success) {
      if (result.settings) setSettings(result.settings)
      setDirty(false)
      // Push the change to every live consumer (driver/business sessions pick
      // it up via polling; this updates the admin's own session immediately).
      invalidateFeatureSettings()
      toast.success('Operations settings saved')
    } else {
      toast.error(result.error || 'Failed to save settings')
    }
  }

  return (
    <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2 text-foreground">
          <Layers className="w-5 h-5" />
          Operations & Feature Flags
        </CardTitle>
        <CardDescription>
          Control the cross-dock operating model. Use a mode preset to flip routing in one click, or fine-tune below.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Mode presets */}
        <div className="space-y-3">
          <Label className="text-foreground">Operating mode</Label>
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => applyPreset('direct')}
              className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors ${
                currentMode === 'direct'
                  ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5'
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-card-2)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-foreground" />
                <span className="font-medium text-foreground">Direct</span>
                {currentMode === 'direct' && <Badge variant="outline" className="text-[var(--accent-orange)]">Active</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">Point-to-point. One driver per job, no hub. Classic dispatch.</p>
            </button>
            <button
              type="button"
              onClick={() => applyPreset('cross_dock')}
              className={`flex flex-col items-start gap-1 rounded-lg border p-4 text-left transition-colors ${
                currentMode === 'cross_dock'
                  ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5'
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-card-2)]'
              }`}
            >
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-foreground" />
                <span className="font-medium text-foreground">Cross-dock</span>
                {currentMode === 'cross_dock' && <Badge variant="outline" className="text-[var(--accent-orange)]">Active</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">Zone-based with hub consolidation, cutoffs, and transfers.</p>
            </button>
          </div>
          {currentMode === null && (
            <p className="text-xs text-muted-foreground">Custom configuration (does not match a preset).</p>
          )}
        </div>

        <Separator className="bg-[var(--border-color)]" />

        {/* Toggle groups */}
        <fieldset disabled={loading} className="space-y-6">
          {GROUPS.map((group) => (
            <div key={group.title} className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {group.icon}
                {group.title}
              </div>
              <div className="space-y-3">
                {group.toggles.map((t) => (
                  <div key={t.key} className="flex items-start justify-between gap-4">
                    <div className="space-y-0.5">
                      <Label htmlFor={t.key} className="text-foreground">{t.label}</Label>
                      <p className="text-sm text-muted-foreground">{t.description}</p>
                    </div>
                    <Switch
                      id={t.key}
                      checked={settings[t.key]}
                      onCheckedChange={(v) => setBool(t.key, v)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <Separator className="bg-[var(--border-color)]" />

          {/* Enum settings */}
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-foreground flex items-center gap-2">
                <MapPin className="w-4 h-4" /> Address validation
              </Label>
              <div className="flex gap-2">
                {(['off', 'soft', 'hard'] as const).map((level) => (
                  <Button
                    key={level}
                    type="button"
                    variant={settings.address_validation_level === level ? 'default' : 'outline'}
                    size="sm"
                    className={settings.address_validation_level === level ? 'bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white' : ''}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, address_validation_level: level }))
                      setDirty(true)
                    }}
                  >
                    {level === 'off' ? 'Off' : level === 'soft' ? 'Soft' : 'Hard'}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Soft warns on low-confidence addresses; Hard blocks them.</p>
            </div>

            <div className="space-y-2">
              <Label className="text-foreground flex items-center gap-2">
                <ScanLine className="w-4 h-4" /> Driver pay model
              </Label>
              <div className="flex gap-2">
                {(['per_order', 'per_leg'] as const).map((model) => (
                  <Button
                    key={model}
                    type="button"
                    variant={settings.driver_pay_model === model ? 'default' : 'outline'}
                    size="sm"
                    className={settings.driver_pay_model === model ? 'bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white' : ''}
                    onClick={() => {
                      setSettings((prev) => ({ ...prev, driver_pay_model: model }))
                      setDirty(true)
                    }}
                  >
                    {model === 'per_order' ? 'Per order' : 'Per leg'}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">Per-leg pays pickup and delivery legs separately.</p>
            </div>
          </div>
        </fieldset>

        <Button
          onClick={handleSave}
          disabled={saving || loading || !dirty}
          className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
        >
          <Save className="w-4 h-4 mr-2" />
          {saving ? 'Saving...' : 'Save Operations Settings'}
        </Button>
      </CardContent>
    </Card>
  )
}
