'use client'

import { useState } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { 
  Shield,
  Bell,
  Moon,
  Lock,
  LogOut,
  Clock,
  Users,
  Zap,
  X,
  Save,
} from 'lucide-react'

export function AdminSettings() {
  const { currentUser, logout, settings, updateSettings, drivers, updateDriverCapacity } = useApp()
  
  const [localSettings, setLocalSettings] = useState({
    globalMaxJobs: settings.globalMaxJobs,
    rushSlaMins: settings.rushSlaMins,
    intownTimeoutMins: settings.intownTimeoutMins,
    outOfTownTimeoutMins: settings.outOfTownTimeoutMins,
    invoiceDueDays: settings.invoiceDueDays,
    reminderDay1: settings.reminderDay1,
    overdueDay: settings.overdueDay,
    escalationDay: settings.escalationDay,
    autoGenerateInvoices: settings.autoGenerateInvoices,
    autoSendInvoices: settings.autoSendInvoices,
  })
  
  const [driverOverrides, setDriverOverrides] = useState<Record<string, string>>(() => {
    const overrides: Record<string, string> = {}
    drivers.forEach(d => {
      overrides[d.id] = d.maxJobsOverride?.toString() || ''
    })
    return overrides
  })

  const handleSaveSettings = () => {
    updateSettings(localSettings)
    toast.success('Settings saved')
  }
  
  const handleSaveCapacity = () => {
    drivers.forEach(d => {
      const override = driverOverrides[d.id]
      const value = override === '' ? null : parseInt(override)
      if (value !== d.maxJobsOverride) {
        updateDriverCapacity(d.id, value)
      }
    })
    toast.success('Capacity settings saved')
  }
  
  const clearOverride = (driverId: string) => {
    setDriverOverrides(prev => ({ ...prev, [driverId]: '' }))
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Driver Capacity Section */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Users className="w-5 h-5" />
            Driver Capacity
          </CardTitle>
          <CardDescription>Configure maximum concurrent jobs per driver</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Global Max */}
          <div className="space-y-2">
            <Label className="text-foreground">Global Max Jobs</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="10"
                value={localSettings.globalMaxJobs}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, globalMaxJobs: parseInt(e.target.value) || 3 }))}
                className="w-24 bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
              <span className="text-sm text-muted-foreground">
                Applies to all drivers unless individually overridden
              </span>
            </div>
          </div>
          
          <Separator className="bg-[var(--border-color)]" />
          
          {/* Per Driver Overrides */}
          <div className="space-y-3">
            <Label className="text-foreground">Per Driver Overrides</Label>
            <div className="rounded-lg border border-[var(--border-color)] overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-[var(--bg-card-2)]">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Driver</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Global Default</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Override</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((driver) => (
                    <tr key={driver.id} className="border-t border-[var(--border-color)]">
                      <td className="p-3 text-foreground">{driver.name}</td>
                      <td className="p-3 text-center text-muted-foreground">{localSettings.globalMaxJobs}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            max="10"
                            placeholder="-"
                            value={driverOverrides[driver.id]}
                            onChange={(e) => setDriverOverrides(prev => ({ 
                              ...prev, 
                              [driver.id]: e.target.value 
                            }))}
                            className="w-16 text-center bg-[var(--bg-card-2)] border-[var(--border-color)]"
                          />
                          {driverOverrides[driver.id] && (
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => clearOverride(driver.id)}
                              className="h-8 w-8"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-center">
                        <Badge variant="outline" className={driverOverrides[driver.id] ? 'text-[var(--accent-orange)]' : 'text-muted-foreground'}>
                          {driverOverrides[driver.id] ? 'Custom' : 'Using global'}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <Button 
            onClick={handleSaveCapacity}
            className="bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Capacity Settings
          </Button>
          
          <p className="text-xs text-muted-foreground">
            Changes apply to future claims only. Drivers currently over the new limit keep existing jobs.
          </p>
        </CardContent>
      </Card>

      {/* Rush SLA & Timeouts */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Zap className="w-5 h-5" />
            Rush SLA & Timeouts
          </CardTitle>
          <CardDescription>Configure time-based alerts and SLA requirements</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Rush SLA (mins)</Label>
              <Input
                type="number"
                min="15"
                max="120"
                value={localSettings.rushSlaMins}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, rushSlaMins: parseInt(e.target.value) || 45 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
              <p className="text-xs text-muted-foreground">Pickup must occur within this time</p>
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">In-Town Timeout (mins)</Label>
              <Input
                type="number"
                min="30"
                max="300"
                value={localSettings.intownTimeoutMins}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, intownTimeoutMins: parseInt(e.target.value) || 120 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
              <p className="text-xs text-muted-foreground">Alert after no update</p>
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-foreground">Out of Town Timeout (mins)</Label>
            <Input
              type="number"
              min="60"
              max="480"
              value={localSettings.outOfTownTimeoutMins}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, outOfTownTimeoutMins: parseInt(e.target.value) || 240 }))}
              className="w-1/2 bg-[var(--bg-card-2)] border-[var(--border-color)]"
            />
          </div>
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Clock className="w-5 h-5" />
            Invoice Settings
          </CardTitle>
          <CardDescription>Configure billing automation and reminders</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Invoice Due Days</Label>
              <Input
                type="number"
                min="7"
                max="60"
                value={localSettings.invoiceDueDays}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, invoiceDueDays: parseInt(e.target.value) || 15 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">First Reminder (days before due)</Label>
              <Input
                type="number"
                min="1"
                max="14"
                value={localSettings.reminderDay1}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, reminderDay1: parseInt(e.target.value) || 7 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-foreground">Overdue Reminder (days after due)</Label>
              <Input
                type="number"
                min="1"
                max="30"
                value={localSettings.overdueDay}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, overdueDay: parseInt(e.target.value) || 7 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-foreground">Escalation (days after due)</Label>
              <Input
                type="number"
                min="7"
                max="60"
                value={localSettings.escalationDay}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, escalationDay: parseInt(e.target.value) || 14 }))}
                className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
            </div>
          </div>
          
          <Separator className="bg-[var(--border-color)]" />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-generate Invoices</p>
              <p className="text-xs text-muted-foreground">Automatically create invoices at month end</p>
            </div>
            <Switch 
              checked={localSettings.autoGenerateInvoices}
              onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, autoGenerateInvoices: c }))}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Auto-send Invoices</p>
              <p className="text-xs text-muted-foreground">Automatically email invoices when generated</p>
            </div>
            <Switch 
              checked={localSettings.autoSendInvoices}
              onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, autoSendInvoices: c }))}
            />
          </div>
          
          <Button 
            onClick={handleSaveSettings}
            className="bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Notifications */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Bell className="w-5 h-5" />
            Notifications
          </CardTitle>
          <CardDescription>Configure your notification preferences</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Rush Job Alerts</p>
              <p className="text-xs text-muted-foreground">Get notified when rush jobs are posted</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator className="bg-[var(--border-color)]" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Timeout Warnings</p>
              <p className="text-xs text-muted-foreground">Alerts when drivers have no updates</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator className="bg-[var(--border-color)]" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Flag Notifications</p>
              <p className="text-xs text-muted-foreground">Alerts when drivers raise flags</p>
            </div>
            <Switch defaultChecked />
          </div>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Lock className="w-5 h-5" />
            Security
          </CardTitle>
          <CardDescription>Account security settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button variant="outline" className="w-full justify-start gap-2">
            <Lock className="w-4 h-4" />
            Change Password
          </Button>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Shield className="w-4 h-4" />
            Two-Factor Authentication
          </Button>
        </CardContent>
      </Card>

      {/* Sign Out */}
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
