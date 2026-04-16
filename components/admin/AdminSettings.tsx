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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { 
  Shield,
  Bell,
  Lock,
  LogOut,
  Clock,
  Users,
  Zap,
  X,
  Save,
  Smartphone,
  CheckCircle2,
  Eye,
  EyeOff,
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

  // Password change dialog state
  const [showPasswordDialog, setShowPasswordDialog] = useState(false)
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [pwSaving, setPwSaving] = useState(false)

  // 2FA dialog state
  const [show2faDialog, setShow2faDialog] = useState(false)
  const [twoFaEnabled, setTwoFaEnabled] = useState(false)
  const [twoFaStep, setTwoFaStep] = useState<'intro' | 'verify' | 'done'>('intro')
  const [twoFaCode, setTwoFaCode] = useState('')
  const [twoFaPhone, setTwoFaPhone] = useState('')

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      toast.error('Please fill in all fields')
      return
    }
    if (pwForm.next.length < 8) {
      toast.error('New password must be at least 8 characters')
      return
    }
    if (pwForm.next !== pwForm.confirm) {
      toast.error('New passwords do not match')
      return
    }
    setPwSaving(true)
    // Simulate network request
    await new Promise(r => setTimeout(r, 600))
    setPwSaving(false)
    setShowPasswordDialog(false)
    setPwForm({ current: '', next: '', confirm: '' })
    toast.success('Password changed successfully')
  }

  const handleStart2fa = () => {
    if (!twoFaPhone || twoFaPhone.replace(/\D/g, '').length < 10) {
      toast.error('Enter a valid phone number')
      return
    }
    setTwoFaStep('verify')
    toast.success('Verification code sent')
  }

  const handleVerify2fa = () => {
    if (twoFaCode.length !== 6) {
      toast.error('Enter the 6-digit code')
      return
    }
    setTwoFaEnabled(true)
    setTwoFaStep('done')
    toast.success('Two-factor authentication enabled')
  }

  const handleDisable2fa = () => {
    setTwoFaEnabled(false)
    setTwoFaStep('intro')
    setTwoFaCode('')
    setTwoFaPhone('')
    setShow2faDialog(false)
    toast.success('Two-factor authentication disabled')
  }

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
            <div className="rounded-lg border border-[var(--border-color)] overflow-x-auto">
              <table className="w-full min-w-[520px]">
                <thead>
                  <tr className="bg-[var(--bg-card-2)]">
                    <th className="text-left p-3 text-sm font-medium text-muted-foreground">Driver</th>
                    <th className="text-center p-3 text-sm font-medium text-muted-foreground">Default</th>
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
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => setShowPasswordDialog(true)}
          >
            <Lock className="w-4 h-4" />
            Change Password
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => {
              setTwoFaStep(twoFaEnabled ? 'done' : 'intro')
              setShow2faDialog(true)
            }}
          >
            <Shield className="w-4 h-4" />
            Two-Factor Authentication
            {twoFaEnabled && (
              <Badge variant="outline" className="ml-auto border-green-500/30 text-green-400">
                Enabled
              </Badge>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>
              Enter your current password and choose a new one. Passwords must be at least 8 characters.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="current-pw">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-pw"
                  type={showPw ? 'text' : 'password'}
                  value={pwForm.current}
                  onChange={(e) => setPwForm({ ...pwForm, current: e.target.value })}
                  autoComplete="current-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowPw(!showPw)}
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw">New Password</Label>
              <Input
                id="new-pw"
                type={showPw ? 'text' : 'password'}
                value={pwForm.next}
                onChange={(e) => setPwForm({ ...pwForm, next: e.target.value })}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">Confirm New Password</Label>
              <Input
                id="confirm-pw"
                type={showPw ? 'text' : 'password'}
                value={pwForm.confirm}
                onChange={(e) => setPwForm({ ...pwForm, confirm: e.target.value })}
                autoComplete="new-password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowPasswordDialog(false)
                setPwForm({ current: '', next: '', confirm: '' })
              }}
              disabled={pwSaving}
            >
              Cancel
            </Button>
            <Button onClick={handleChangePassword} disabled={pwSaving}>
              {pwSaving ? 'Saving...' : 'Update Password'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Two-Factor Authentication Dialog */}
      <Dialog open={show2faDialog} onOpenChange={setShow2faDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Two-Factor Authentication</DialogTitle>
            <DialogDescription>
              {twoFaStep === 'intro' && 'Add an extra layer of security to your account using SMS verification.'}
              {twoFaStep === 'verify' && 'Enter the 6-digit code sent to your phone.'}
              {twoFaStep === 'done' && 'Two-factor authentication is currently active on your account.'}
            </DialogDescription>
          </DialogHeader>

          {twoFaStep === 'intro' && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-[var(--bg-card-2)] border border-[var(--border-color)]">
                <Smartphone className="w-5 h-5 text-[var(--accent-orange)] mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">SMS verification</p>
                  <p className="text-muted-foreground">
                    We&apos;ll text a 6-digit code to your phone each time you sign in.
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="2fa-phone">Phone Number</Label>
                <Input
                  id="2fa-phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={twoFaPhone}
                  onChange={(e) => setTwoFaPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
            </div>
          )}

          {twoFaStep === 'verify' && (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="2fa-code">Verification Code</Label>
                <Input
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  value={twoFaCode}
                  onChange={(e) => setTwoFaCode(e.target.value.replace(/\D/g, ''))}
                  className="text-center text-lg tracking-widest"
                />
                <p className="text-xs text-muted-foreground">
                  Sent to {twoFaPhone}. Didn&apos;t receive it?{' '}
                  <button
                    type="button"
                    className="text-[var(--accent-orange)] hover:underline"
                    onClick={() => toast.success('Code resent')}
                  >
                    Resend
                  </button>
                </p>
              </div>
            </div>
          )}

          {twoFaStep === 'done' && (
            <div className="space-y-4 py-2">
              <div className="flex items-start gap-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                <div className="text-sm">
                  <p className="font-medium text-foreground">2FA is enabled</p>
                  <p className="text-muted-foreground">
                    Verified phone: {twoFaPhone || 'on file'}
                  </p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            {twoFaStep === 'intro' && (
              <>
                <Button variant="outline" onClick={() => setShow2faDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={handleStart2fa}>Send Code</Button>
              </>
            )}
            {twoFaStep === 'verify' && (
              <>
                <Button variant="outline" onClick={() => setTwoFaStep('intro')}>
                  Back
                </Button>
                <Button onClick={handleVerify2fa}>Verify &amp; Enable</Button>
              </>
            )}
            {twoFaStep === 'done' && (
              <>
                <Button variant="outline" onClick={() => setShow2faDialog(false)}>
                  Close
                </Button>
                <Button variant="destructive" onClick={handleDisable2fa}>
                  Disable 2FA
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
