'use client'

import { useState, useEffect } from 'react'
import { useApp } from '@/lib/context'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import { ThemeToggleRow } from '@/components/shared/ThemeToggleRow'
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
  Moon,
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
  Radio,
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
    reviewReminderDays: settings.reviewReminderDays,
    sendReminderEmail: settings.sendReminderEmail,
    sendReminderSms: settings.sendReminderSms,
    // SMS feature toggles
    smsNotifyEnRoutePickup: settings.smsNotifyEnRoutePickup,
    smsNotifyPickedUp: settings.smsNotifyPickedUp,
    smsNotifyFailedAttempt: settings.smsNotifyFailedAttempt,
    smsNotifyCancelled: settings.smsNotifyCancelled,
    smsNotifyReassigned: settings.smsNotifyReassigned,
    smsNotifyFeedbackRequest: settings.smsNotifyFeedbackRequest,
    smsNotifyInvoiceReady: settings.smsNotifyInvoiceReady,
    smsNotifyPaymentReceived: settings.smsNotifyPaymentReceived,
    smsNotifyWeeklySummary: settings.smsNotifyWeeklySummary,
    smsOptOutManagement: settings.smsOptOutManagement,
    smsShiftReminder: settings.smsShiftReminder,
    smsEarningsSummary: settings.smsEarningsSummary,
    // Dispatch mode
    allowDriverSelfClaim: settings.allowDriverSelfClaim,
  })
  
  const [driverOverrides, setDriverOverrides] = useState<Record<string, string>>(() => {
    const overrides: Record<string, string> = {}
    drivers.forEach(d => {
      overrides[d.id] = d.maxJobsOverride?.toString() || ''
    })
    return overrides
  })

  // Sync local settings when context settings change (e.g., after hydration from DB)
  useEffect(() => {
    setLocalSettings({
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
      reviewReminderDays: settings.reviewReminderDays,
      sendReminderEmail: settings.sendReminderEmail,
      sendReminderSms: settings.sendReminderSms,
      smsNotifyEnRoutePickup: settings.smsNotifyEnRoutePickup,
      smsNotifyPickedUp: settings.smsNotifyPickedUp,
      smsNotifyFailedAttempt: settings.smsNotifyFailedAttempt,
      smsNotifyCancelled: settings.smsNotifyCancelled,
      smsNotifyReassigned: settings.smsNotifyReassigned,
      smsNotifyFeedbackRequest: settings.smsNotifyFeedbackRequest,
      smsNotifyInvoiceReady: settings.smsNotifyInvoiceReady,
      smsNotifyPaymentReceived: settings.smsNotifyPaymentReceived,
      smsNotifyWeeklySummary: settings.smsNotifyWeeklySummary,
      smsOptOutManagement: settings.smsOptOutManagement,
      smsShiftReminder: settings.smsShiftReminder,
      smsEarningsSummary: settings.smsEarningsSummary,
      allowDriverSelfClaim: settings.allowDriverSelfClaim,
    })
  }, [settings])

  // Sync driver overrides when drivers change (e.g., after hydration from DB)
  useEffect(() => {
    const overrides: Record<string, string> = {}
    drivers.forEach(d => {
      overrides[d.id] = d.maxJobsOverride?.toString() || ''
    })
    setDriverOverrides(overrides)
  }, [drivers])

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

  const handleSaveDispatchMode = () => {
    updateSettings({ allowDriverSelfClaim: localSettings.allowDriverSelfClaim })
    toast.success('Dispatch mode updated')
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
      {/* Dispatch Mode Section */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Radio className="w-5 h-5" />
            Dispatch Mode
          </CardTitle>
          <CardDescription>
            Control how drivers receive delivery assignments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            <label 
              className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                localSettings.allowDriverSelfClaim 
                  ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5' 
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-card-2)]'
              }`}
            >
              <input
                type="radio"
                name="dispatchMode"
                checked={localSettings.allowDriverSelfClaim}
                onChange={() => setLocalSettings(prev => ({ ...prev, allowDriverSelfClaim: true }))}
                className="mt-1 accent-[var(--accent-orange)]"
              />
              <div>
                <p className="font-medium text-foreground">Driver Self-Claim</p>
                <p className="text-sm text-muted-foreground">
                  Drivers browse available jobs and claim them independently. Best for flexible workforces.
                </p>
              </div>
            </label>
            
            <label 
              className={`flex items-start gap-4 p-4 border rounded-lg cursor-pointer transition-colors ${
                !localSettings.allowDriverSelfClaim 
                  ? 'border-[var(--accent-orange)] bg-[var(--accent-orange)]/5' 
                  : 'border-[var(--border-color)] hover:bg-[var(--bg-card-2)]'
              }`}
            >
              <input
                type="radio"
                name="dispatchMode"
                checked={!localSettings.allowDriverSelfClaim}
                onChange={() => setLocalSettings(prev => ({ ...prev, allowDriverSelfClaim: false }))}
                className="mt-1 accent-[var(--accent-orange)]"
              />
              <div>
                <p className="font-medium text-foreground">Admin Assignment</p>
                <p className="text-sm text-muted-foreground">
                  Dispatch assigns jobs to drivers via the Dispatch Board. Drivers cannot claim jobs themselves.
                </p>
              </div>
            </label>
          </div>
          
          {!localSettings.allowDriverSelfClaim && (
            <div className="flex items-center gap-2 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-sm text-blue-600">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                Go to <strong>Dispatch</strong> in the sidebar to assign jobs to drivers.
              </span>
            </div>
          )}

          <Button 
            onClick={handleSaveDispatchMode}
            className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Dispatch Mode
          </Button>
        </CardContent>
      </Card>

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
      <Card id="invoice-settings" className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Clock className="w-5 h-5" />
            Invoice Settings
          </CardTitle>
          <CardDescription>Configure billing automation, reminders, and escalation</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto-generate drafts */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Auto-generate draft invoices on the 28th of each month</p>
              <p className="text-xs text-muted-foreground mt-0.5">Drafts are generated but not sent &mdash; review period is 28th to 31st</p>
            </div>
            <Switch
              checked={localSettings.autoGenerateInvoices}
              onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, autoGenerateInvoices: c }))}
            />
          </div>

          <Separator className="bg-[var(--border-color)]" />

          {/* Auto-send invoices */}
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Automatically send invoices on the 1st of each month</p>
                <p className="text-xs text-muted-foreground mt-0.5">When OFF &mdash; invoices stay as draft until you manually send them</p>
              </div>
              <Switch
                checked={localSettings.autoSendInvoices}
                onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, autoSendInvoices: c }))}
              />
            </div>

            {localSettings.autoSendInvoices ? (
              <Badge variant="outline" className="border-green-500/40 bg-green-500/10 text-green-400 gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Invoices send automatically on the 1st
              </Badge>
            ) : (
              <>
                <Badge variant="outline" className="border-yellow-500/40 bg-yellow-500/10 text-yellow-400 gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
                  Manual send required
                </Badge>
                <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-200/90">
                  Auto-send is off. Invoices will be generated as drafts on the 28th but will not send until you manually approve and send them from the Invoices page.
                </div>
              </>
            )}
          </div>

          <Separator className="bg-[var(--border-color)]" />

          {/* Invoice due days */}
          <div className="space-y-2">
            <Label className="text-foreground">Invoice due days after sending</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min="1"
                max="60"
                value={localSettings.invoiceDueDays}
                onChange={(e) => setLocalSettings(prev => ({ ...prev, invoiceDueDays: parseInt(e.target.value) || 15 }))}
                className="w-24 bg-[var(--bg-card-2)] border-[var(--border-color)]"
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            <p className="text-xs text-muted-foreground">
              e.g. Invoice sent April 1 &rarr; due April {(1 + (localSettings.invoiceDueDays || 15))}
            </p>
          </div>

          <Separator className="bg-[var(--border-color)]" />

          {/* Reminder schedule with timeline */}
          <div className="space-y-4">
            <Label className="text-foreground">Reminder schedule (applies to all unpaid invoices)</Label>

            <ReminderTimeline
              reminder1={localSettings.reminderDay1}
              overdue={localSettings.overdueDay}
              escalation={localSettings.escalationDay}
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ReminderField
                label="First reminder"
                suffix="after sending"
                value={localSettings.reminderDay1}
                min={1}
                max={30}
                onChange={(v) => setLocalSettings(prev => ({ ...prev, reminderDay1: v }))}
              />
              <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-3">
                <p className="text-xs text-muted-foreground">Second reminder</p>
                <p className="text-sm font-medium text-foreground mt-1">On due date (locked)</p>
              </div>
              <ReminderField
                label="Overdue notice"
                suffix="after due date"
                value={localSettings.overdueDay}
                min={1}
                max={60}
                onChange={(v) => setLocalSettings(prev => ({ ...prev, overdueDay: v }))}
              />
              <ReminderField
                label="Escalation"
                suffix="after due date"
                value={localSettings.escalationDay}
                min={1}
                max={120}
                onChange={(v) => setLocalSettings(prev => ({ ...prev, escalationDay: v }))}
              />
            </div>

            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-3 text-xs text-muted-foreground">
              Once escalated, automatic reminders stop. Admin must handle the invoice manually.
            </div>
          </div>

          <Separator className="bg-[var(--border-color)]" />

          {/* Review period reminder */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Remind me to review drafts before auto-send</p>
            </div>
            <select
              value={localSettings.reviewReminderDays}
              onChange={(e) => setLocalSettings(prev => ({ ...prev, reviewReminderDays: parseInt(e.target.value) }))}
              className="rounded-md border border-[var(--border-color)] bg-[var(--bg-card-2)] text-foreground text-sm px-3 py-2 min-h-[40px]"
              aria-label="Review reminder days"
            >
              <option value={1}>1 day before</option>
              <option value={2}>2 days before</option>
              <option value={3}>3 days before</option>
              <option value={0}>Don&apos;t remind me</option>
            </select>
          </div>

          <Separator className="bg-[var(--border-color)]" />

          {/* Notification preferences */}
          <div className="space-y-3">
            <Label className="text-foreground">Notification preferences</Label>
            <p className="text-xs text-muted-foreground -mt-1">Applies to all reminders (Reminder 1, Reminder 2, overdue notice)</p>

            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">Send reminder via email</p>
              <Switch
                checked={localSettings.sendReminderEmail}
                onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, sendReminderEmail: c }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">Send reminder via SMS</p>
              <Switch
                checked={localSettings.sendReminderSms}
                onCheckedChange={(c) => setLocalSettings(prev => ({ ...prev, sendReminderSms: c }))}
              />
            </div>
          </div>

          <Button
            onClick={handleSaveSettings}
            className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save Invoice Settings
          </Button>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Moon className="w-5 h-5" />
            Appearance
          </CardTitle>
          <CardDescription>Customize how DOMS looks on your device</CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeToggleRow id="admin-dark-mode" />
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

      {/* SMS Settings */}
      <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-foreground">
            <Smartphone className="w-5 h-5" />
            SMS Notifications
          </CardTitle>
          <CardDescription>Control which SMS notifications are sent to customers, drivers, and businesses.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Delivery Flow */}
          <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">Delivery Flow</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyEnRoutePickup}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyEnRoutePickup: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">En Route to Pickup</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyPickedUp}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyPickedUp: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Package Picked Up</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyFailedAttempt}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyFailedAttempt: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Failed Delivery Attempt</span>
              </label>
            </div>
          </div>

          {/* Customer Experience */}
          <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">Customer Experience</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyFeedbackRequest}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyFeedbackRequest: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Feedback Request (30min after delivery)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyReassigned}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyReassigned: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Driver Reassigned</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyCancelled}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyCancelled: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Order Cancelled</span>
              </label>
            </div>
          </div>

          {/* Business Operations */}
          <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">Business Operations</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyInvoiceReady}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyInvoiceReady: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Invoice Ready</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyPaymentReceived}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyPaymentReceived: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Payment Received</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsNotifyWeeklySummary}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsNotifyWeeklySummary: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Weekly Summary</span>
              </label>
            </div>
          </div>

          {/* System Features */}
          <div className="bg-slate-50/50 dark:bg-slate-950/50 p-4 rounded-lg space-y-3">
            <p className="text-sm font-medium text-foreground">System Features</p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsOptOutManagement}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsOptOutManagement: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Opt-Out Management (STOP/START replies)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsShiftReminder}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsShiftReminder: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Shift Reminders (Optional)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={localSettings.smsEarningsSummary}
                  onChange={(e) => setLocalSettings(prev => ({ ...prev, smsEarningsSummary: e.target.checked }))}
                  className="w-4 h-4"
                />
                <span className="text-sm text-foreground">Earnings Summary (Optional)</span>
              </label>
            </div>
          </div>

          <Button 
            onClick={handleSaveSettings}
            className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 text-white"
          >
            <Save className="w-4 h-4 mr-2" />
            Save SMS Settings
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
        onClick={() => { void logout() }}
      >
        <LogOut className="w-4 h-4 mr-2" />
        Sign Out
      </Button>
    </div>
  )
}

// --- Invoice reminder helpers ---

function ReminderTimeline({
  reminder1,
  overdue,
  escalation,
}: {
  reminder1: number
  overdue: number
  escalation: number
}) {
  const stops = [
    { label: 'Sent', sub: 'Day 0', color: 'bg-blue-400' },
    { label: 'Reminder 1', sub: `Day ${reminder1}`, color: 'bg-blue-400' },
    { label: 'Reminder 2', sub: 'Due date', color: 'bg-orange-400' },
    { label: 'Overdue', sub: `+${overdue} days`, color: 'bg-red-400' },
    { label: 'Escalated', sub: `+${escalation} days`, color: 'bg-red-600' },
  ]
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-4">
      <div className="flex items-start justify-between gap-2">
        {stops.map((s, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 text-center flex-1 min-w-0">
            <span className={`inline-block h-3 w-3 rounded-full ${s.color}`} />
            <p className="text-[11px] font-medium text-foreground leading-tight">{s.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="relative h-px bg-border mt-2 -mb-1" />
    </div>
  )
}

function ReminderField({
  label,
  suffix,
  value,
  min,
  max,
  onChange,
}: {
  label: string
  suffix: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
}) {
  return (
    <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-card-2)] p-3 space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <span className="text-sm text-foreground">Day</span>
        <Input
          type="number"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(parseInt(e.target.value) || min)}
          className="w-20 bg-[var(--bg-card)] border-[var(--border-color)] text-center"
        />
        <span className="text-sm text-muted-foreground">{suffix}</span>
      </div>
    </div>
  )
}
