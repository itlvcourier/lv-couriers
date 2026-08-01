'use client'

import { useState } from 'react'
import useSWR, { mutate } from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Spinner } from '@/components/ui/spinner'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { toast } from 'sonner'
import {
  Users,
  Plus,
  Phone,
  Mail,
  Search,
  LayoutGrid,
  Table,
  Pencil,
  Trash2,
  TrendingUp,
  Award,
  Clock,
  Package,
  DollarSign,
  AlertTriangle,
  Settings,
  ToggleLeft,
  ToggleRight,
  MinusCircle,
  PlusCircle,
  Save,
  BarChart3,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  getDrivers,
  getDriverHistory,
  type DbDriver,
  type DbDelivery,
} from '@/lib/db'
import { createClient } from '@/lib/supabase/client'
import { useApp } from '@/lib/context'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function formatMins(mins: number | null) {
  if (mins === null) return '—'
  if (mins < 60) return `${Math.round(mins)}m`
  const h = Math.floor(mins / 60)
  const m = Math.round(mins % 60)
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function getSlaColor(rate: number | null) {
  if (rate === null) return 'text-muted-foreground'
  if (rate >= 90) return 'text-green-400'
  if (rate >= 70) return 'text-yellow-400'
  return 'text-red-400'
}

function calcLivePerformance(history: DbDelivery[], rushSlaMins = 45) {
  const delivered = history.filter(d => d.status === 'delivered' && d.delivered_at)
  const rushJobs = delivered.filter(d => d.is_rush)

  // Average delivery time (pickup to delivered)
  const withTimes = delivered.filter(
    d => d.picked_up_at && d.delivered_at
  )
  const avgMins = withTimes.length > 0
    ? withTimes.reduce((sum, d) => {
        const mins =
          (new Date(d.delivered_at!).getTime() - new Date(d.picked_up_at!).getTime()) / 60000
        return sum + mins
      }, 0) / withTimes.length
    : null

  // Rush SLA: count rush deliveries where time from claimed to delivered <= rushSlaMins
  const rushWithTimes = rushJobs.filter(d => d.claimed_at && d.delivered_at)
  const rushMetSla = rushWithTimes.filter(d => {
    const mins =
      (new Date(d.delivered_at!).getTime() - new Date(d.claimed_at!).getTime()) / 60000
    return mins <= rushSlaMins
  })
  const rushSlaRate =
    rushWithTimes.length > 0
      ? Math.round((rushMetSla.length / rushWithTimes.length) * 100)
      : null

  // Earnings
  const totalEarnings = delivered.reduce((sum, d) => {
    const pay = (d.pickup_pay ?? 0) + (d.delivery_pay ?? 0)
    return sum + pay
  }, 0)

  return {
    totalDelivered: delivered.length,
    rushJobs: rushJobs.length,
    avgMins: avgMins !== null ? Math.round(avgMins) : null,
    rushSlaRate,
    totalEarnings,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export function AdminDrivers() {
  const { settings, updateDriverCapacity } = useApp()

  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<'cards' | 'performance'>('cards')
  const [showAddSheet, setShowAddSheet] = useState(false)
  const [selectedDriver, setSelectedDriver] = useState<DbDriver | null>(null)
  const [detailTab, setDetailTab] = useState('overview')
  const [isEditing, setIsEditing] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', email: '', phone: '' })
  const [isSavingEdit, setIsSavingEdit] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Per-driver capacity editing
  const [editCapacity, setEditCapacity] = useState<string>('')
  const [isSavingCapacity, setIsSavingCapacity] = useState(false)

  // Monthly adjustment editing
  const [editAdjustment, setEditAdjustment] = useState<string>('')
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false)

  // Fetch drivers
  const { data: drivers = [], isLoading } = useSWR('all-drivers', getDrivers, {
    refreshInterval: 30000,
  })

  // Fetch selected driver's history (all delivered jobs)
  const { data: driverHistory = [] } = useSWR(
    selectedDriver ? `driver-history-${selectedDriver.id}` : null,
    () => (selectedDriver ? getDriverHistory(selectedDriver.id, 500) : []),
  )

  const [form, setForm] = useState({ name: '', email: '', phone: '' })

  const filteredDrivers = drivers.filter((d: DbDriver) => {
    const q = search.toLowerCase()
    return (
      d.name.toLowerCase().includes(q) ||
      d.email.toLowerCase().includes(q) ||
      d.phone.includes(q)
    )
  })

  // ── Add driver ──────────────────────────────────────────────────────────────

  const handleAddDriver = async () => {
    if (!form.name || !form.email || !form.phone) {
      toast.error('Please fill in all fields')
      return
    }
    try {
      const res = await fetch('/api/drivers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to invite driver')
        return
      }
      mutate('all-drivers')
      setForm({ name: '', email: '', phone: '' })
      setShowAddSheet(false)
      const channels: string[] = []
      if (data.emailSent) channels.push('email')
      if (data.smsSent) channels.push('SMS')
      toast.success(
        channels.length > 0
          ? `Driver created. Welcome ${channels.join(' + ')} sent to ${data.email}`
          : `Driver created (temp password: ${data.tempPassword})`,
        { duration: channels.length > 0 ? 4000 : 15000 },
      )
    } catch {
      toast.error('Failed to invite driver')
    }
  }

  // ── Edit contact info ──────────────────────────────────────────────────────

  const openEdit = () => {
    if (!selectedDriver) return
    setEditForm({
      name: selectedDriver.name,
      email: selectedDriver.email,
      phone: selectedDriver.phone,
    })
    setIsEditing(true)
  }

  const handleSaveEdit = async () => {
    if (!selectedDriver) return
    if (!editForm.name.trim() || !editForm.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setIsSavingEdit(true)
    try {
      const res = await fetch(`/api/drivers/${selectedDriver.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to update driver')
        return
      }
      mutate('all-drivers')
      setSelectedDriver({
        ...selectedDriver,
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        phone: editForm.phone.trim(),
      })
      setIsEditing(false)
      toast.success('Driver updated')
    } catch {
      toast.error('Failed to update driver')
    } finally {
      setIsSavingEdit(false)
    }
  }

  // ── Status / invite status ─────────────────────────────────────────────────

  const setInviteStatus = async (driverId: string, status: 'active' | 'deactivated') => {
    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({ invite_status: status })
      .eq('id', driverId)
    if (error) {
      toast.error('Failed to update driver status')
      return
    }
    mutate('all-drivers')
    setSelectedDriver(prev => (prev ? { ...prev, invite_status: status } : prev))
    toast.success(status === 'active' ? 'Driver activated' : 'Driver deactivated')
  }

  const setDriverDutyStatus = async (driverId: string, status: 'available' | 'off_duty') => {
    const supabase = createClient()
    const { error } = await supabase
      .from('drivers')
      .update({ status })
      .eq('id', driverId)
    if (error) {
      toast.error('Failed to update duty status')
      return
    }
    mutate('all-drivers')
    setSelectedDriver(prev => (prev ? { ...prev, status } : prev))
    toast.success(status === 'available' ? 'Marked as available' : 'Marked as off duty')
  }

  // ── Capacity ───────────────────────────────────────────────────────────────

  const openCapacityEdit = () => {
    if (!selectedDriver) return
    setEditCapacity(
      selectedDriver.max_jobs_override !== null
        ? String(selectedDriver.max_jobs_override)
        : '',
    )
  }

  const handleSaveCapacity = async () => {
    if (!selectedDriver) return
    setIsSavingCapacity(true)
    try {
      const val = editCapacity.trim() === '' ? null : parseInt(editCapacity, 10)
      if (val !== null && (isNaN(val) || val < 1 || val > 99)) {
        toast.error('Capacity must be between 1 and 99')
        return
      }
      const supabase = createClient()
      await supabase.from('drivers').update({ max_jobs_override: val }).eq('id', selectedDriver.id)
      updateDriverCapacity(selectedDriver.id, val)
      mutate('all-drivers')
      setSelectedDriver(prev => (prev ? { ...prev, max_jobs_override: val } : prev))
      setEditCapacity('')
      toast.success(val === null ? 'Capacity reset to default' : `Capacity set to ${val}`)
    } catch {
      toast.error('Failed to update capacity')
    } finally {
      setIsSavingCapacity(false)
    }
  }

  // ── Monthly adjustment ─────────────────────────────────────────────────────

  const handleSaveAdjustment = async () => {
    if (!selectedDriver) return
    setIsSavingAdjustment(true)
    try {
      const val = parseFloat(editAdjustment)
      if (isNaN(val)) {
        toast.error('Enter a valid number (can be negative for deductions)')
        return
      }
      const supabase = createClient()
      await supabase
        .from('drivers')
        .update({ monthly_adjustments: val })
        .eq('id', selectedDriver.id)
      mutate('all-drivers')
      setSelectedDriver(prev => (prev ? { ...prev, monthly_adjustments: val } : prev))
      setEditAdjustment('')
      toast.success(`Monthly adjustment set to $${val >= 0 ? '+' : ''}${val.toFixed(2)}`)
    } catch {
      toast.error('Failed to save adjustment')
    } finally {
      setIsSavingAdjustment(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDeleteDriver = async () => {
    if (!selectedDriver) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/drivers/${selectedDriver.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error || 'Failed to delete driver', { duration: 8000 })
        return
      }
      mutate('all-drivers')
      toast.success('Driver permanently deleted')
      setShowDeleteConfirm(false)
      setSelectedDriver(null)
    } catch {
      toast.error('Failed to delete driver')
    } finally {
      setIsDeleting(false)
    }
  }

  // ── Status colors ──────────────────────────────────────────────────────────

  const statusColors: Record<string, string> = {
    available: 'bg-green-500/10 text-green-400 border-green-500/20',
    on_delivery: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    off_duty: 'bg-muted text-muted-foreground border-border',
  }
  const inviteColors: Record<string, string> = {
    active: 'bg-green-500/10 text-green-400',
    pending: 'bg-yellow-500/10 text-yellow-400',
    deactivated: 'bg-red-500/10 text-red-400',
  }
  const statusLabel: Record<string, string> = {
    available: 'Available',
    on_delivery: 'On Delivery',
    off_duty: 'Off Duty',
  }

  // Live perf for selected driver
  const livePerf = driverHistory.length > 0
    ? calcLivePerformance(driverHistory, settings.rushSlaMins ?? 45)
    : null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner className="w-8 h-8" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Drivers</h2>
            <p className="text-sm text-muted-foreground">{drivers.length} total · {drivers.filter((d: DbDriver) => d.invite_status === 'active').length} active</p>
          </div>
          <Button
            onClick={() => setShowAddSheet(true)}
            className="gap-2 bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Add Driver</span>
            <span className="sm:hidden">Add</span>
          </Button>
        </div>
        <div className="flex items-center rounded-lg border border-[var(--border-color)] p-1 w-fit">
          <Button
            variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('cards')}
            className="h-8 px-3"
          >
            <LayoutGrid className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Cards</span>
          </Button>
          <Button
            variant={viewMode === 'performance' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('performance')}
            className="h-8 px-3"
          >
            <BarChart3 className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Performance</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Search drivers..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
        />
      </div>

      {/* ── Cards view ─────────────────────────────────────────────────────── */}
      {viewMode === 'cards' ? (
        filteredDrivers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-1 text-foreground">No drivers found</h3>
            <p className="text-sm text-muted-foreground">Try adjusting your search</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredDrivers.map((driver: DbDriver) => (
              <Card
                key={driver.id}
                className="bg-[var(--bg-card)] border-[var(--border-color)] cursor-pointer hover:bg-[var(--bg-card-hover)] transition-colors"
                onClick={() => {
                  setSelectedDriver(driver)
                  setDetailTab('overview')
                  setIsEditing(false)
                  openCapacityEdit()
                }}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12">
                        <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)]">
                          {getInitials(driver.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-medium text-foreground">{driver.name}</h3>
                        <Badge variant="outline" className={statusColors[driver.status]}>
                          {statusLabel[driver.status] ?? driver.status}
                        </Badge>
                      </div>
                    </div>
                    <Badge className={inviteColors[driver.invite_status]} variant="outline">
                      {driver.invite_status}
                    </Badge>
                  </div>

                  <div className="space-y-1.5 text-sm mb-4">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{driver.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      <span>{driver.phone}</span>
                    </div>
                    {driver.max_jobs_override !== null && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Settings className="w-3.5 h-3.5" />
                        <span>Capacity: {driver.max_jobs_override} jobs</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[var(--border-color)]">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{driver.today_deliveries}</p>
                      <p className="text-xs text-muted-foreground">Today</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">{driver.month_deliveries}</p>
                      <p className="text-xs text-muted-foreground">Month</p>
                    </div>
                    <div className="text-center">
                      <p className={`text-lg font-bold ${getSlaColor(driver.rush_sla_rate)}`}>
                        {driver.rush_sla_rate !== null ? `${driver.rush_sla_rate}%` : '—'}
                      </p>
                      <p className="text-xs text-muted-foreground">SLA</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )
      ) : (
        /* ── Performance table view ─────────────────────────────────────── */
        <Card className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--border-color)]">
                  <th className="text-left p-4 text-sm font-medium text-muted-foreground">Driver</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Status</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Today</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Month</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">All Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Avg Time</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Rush SLA</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Capacity</th>
                  <th className="text-center p-4 text-sm font-medium text-muted-foreground">Adj.</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrivers.map((driver: DbDriver) => (
                  <tr
                    key={driver.id}
                    className="border-b border-[var(--border-color)] hover:bg-[var(--bg-card-hover)] cursor-pointer"
                    onClick={() => {
                      setSelectedDriver(driver)
                      setDetailTab('overview')
                      setIsEditing(false)
                      setEditCapacity(
                        driver.max_jobs_override !== null ? String(driver.max_jobs_override) : '',
                      )
                    }}
                  >
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="w-8 h-8">
                          <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-xs">
                            {getInitials(driver.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <span className="font-medium text-foreground">{driver.name}</span>
                          <p className="text-xs text-muted-foreground">{driver.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <Badge variant="outline" className={statusColors[driver.status]}>
                        {statusLabel[driver.status] ?? driver.status}
                      </Badge>
                    </td>
                    <td className="p-4 text-center text-foreground">{driver.today_deliveries}</td>
                    <td className="p-4 text-center text-foreground">{driver.month_deliveries}</td>
                    <td className="p-4 text-center text-foreground">{driver.total_deliveries}</td>
                    <td className="p-4 text-center text-muted-foreground">{formatMins(driver.avg_delivery_mins)}</td>
                    <td className={`p-4 text-center font-medium ${getSlaColor(driver.rush_sla_rate)}`}>
                      {driver.rush_sla_rate !== null ? `${driver.rush_sla_rate}%` : '—'}
                    </td>
                    <td className="p-4 text-center text-muted-foreground text-sm">
                      {driver.max_jobs_override !== null ? (
                        <span className="text-[var(--accent-orange)]">{driver.max_jobs_override}</span>
                      ) : (
                        <span className="opacity-50">default</span>
                      )}
                    </td>
                    <td className="p-4 text-center text-sm">
                      {(driver.monthly_adjustments ?? 0) !== 0 ? (
                        <span className={(driver.monthly_adjustments ?? 0) > 0 ? 'text-green-400' : 'text-red-400'}>
                          {(driver.monthly_adjustments ?? 0) > 0 ? '+' : ''}
                          {(driver.monthly_adjustments ?? 0).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground opacity-50">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Add Driver Sheet ──────────────────────────────────────────────── */}
      <Sheet open={showAddSheet} onOpenChange={setShowAddSheet}>
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)]">
          <SheetHeader>
            <SheetTitle className="text-foreground">Add New Driver</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {(['name', 'email', 'phone'] as const).map(field => (
              <div key={field} className="space-y-2">
                <Label className="text-foreground capitalize">{field === 'email' ? 'Email' : field === 'phone' ? 'Phone' : 'Full Name'}</Label>
                <Input
                  type={field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  placeholder={field === 'name' ? 'John Doe' : field === 'email' ? 'driver@lvcourier.ca' : '(403) 555-0100'}
                  className="bg-[var(--bg-card-2)] border-[var(--border-color)]"
                />
              </div>
            ))}
            <Button
              onClick={handleAddDriver}
              className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Driver
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Driver Detail Sheet ──────────────────────────────────────────── */}
      <Sheet
        open={!!selectedDriver}
        onOpenChange={open => {
          if (!open) {
            setSelectedDriver(null)
            setIsEditing(false)
            setEditCapacity('')
            setEditAdjustment('')
          }
        }}
      >
        <SheetContent className="bg-[var(--bg-card)] border-l border-[var(--border-color)] w-full sm:max-w-lg overflow-y-auto">
          {selectedDriver && (
            <>
              <SheetHeader className="pb-4 border-b border-[var(--border-color)]">
                <div className="flex items-start gap-4">
                  <Avatar className="w-14 h-14 shrink-0">
                    <AvatarFallback className="bg-[var(--accent-orange)]/10 text-[var(--accent-orange)] text-lg">
                      {getInitials(selectedDriver.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <SheetTitle className="text-foreground text-xl">{selectedDriver.name}</SheetTitle>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={statusColors[selectedDriver.status]}>
                        {statusLabel[selectedDriver.status] ?? selectedDriver.status}
                      </Badge>
                      <Badge className={inviteColors[selectedDriver.invite_status]} variant="outline">
                        {selectedDriver.invite_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </SheetHeader>

              {/* Quick stats */}
              <div className="grid grid-cols-4 gap-2 py-4 border-b border-[var(--border-color)]">
                {[
                  { label: 'Today', value: selectedDriver.today_deliveries },
                  { label: 'Month', value: selectedDriver.month_deliveries },
                  { label: 'Total', value: selectedDriver.total_deliveries },
                  {
                    label: 'SLA',
                    value: selectedDriver.rush_sla_rate !== null ? `${selectedDriver.rush_sla_rate}%` : '—',
                    color: getSlaColor(selectedDriver.rush_sla_rate),
                  },
                ].map(stat => (
                  <div key={stat.label} className="text-center">
                    <p className={`text-base font-bold ${stat.color ?? 'text-foreground'}`}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>

              <Tabs value={detailTab} onValueChange={setDetailTab} className="mt-4">
                <TabsList className="w-full grid grid-cols-3 bg-[var(--bg-card-2)]">
                  <TabsTrigger value="overview">Info</TabsTrigger>
                  <TabsTrigger value="manage">Manage</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                </TabsList>

                {/* ── Overview tab ─────────────────────────────────────── */}
                <TabsContent value="overview" className="mt-4 space-y-4">
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2 flex flex-row items-center justify-between">
                      <CardTitle className="text-sm text-foreground">Contact Information</CardTitle>
                      {!isEditing ? (
                        <Button variant="ghost" size="sm" onClick={openEdit} className="h-7 px-2 text-xs gap-1">
                          <Pencil className="w-3.5 h-3.5" />
                          Edit
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="h-7 px-2 text-xs" disabled={isSavingEdit}>
                          Cancel
                        </Button>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {!isEditing ? (
                        <>
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{selectedDriver.email}</span>
                          </div>
                          <div className="flex items-center gap-2 text-sm">
                            <Phone className="w-4 h-4 text-muted-foreground" />
                            <span className="text-foreground">{selectedDriver.phone}</span>
                          </div>
                        </>
                      ) : (
                        <>
                          {(['name', 'email', 'phone'] as const).map(field => (
                            <div key={field} className="space-y-1">
                              <Label className="text-xs text-muted-foreground capitalize">{field}</Label>
                              <Input
                                type={field === 'email' ? 'email' : 'text'}
                                value={editForm[field]}
                                onChange={e => setEditForm({ ...editForm, [field]: e.target.value })}
                                className="bg-[var(--bg-card)] border-[var(--border-color)] h-9"
                              />
                            </div>
                          ))}
                          <Button
                            size="sm"
                            onClick={handleSaveEdit}
                            disabled={isSavingEdit}
                            className="w-full bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90"
                          >
                            {isSavingEdit ? 'Saving...' : 'Save Changes'}
                          </Button>
                        </>
                      )}
                    </CardContent>
                  </Card>

                  {/* Performance summary using live computed data */}
                  {livePerf && (
                    <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-foreground flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-[var(--accent-orange)]" />
                          Live Performance
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-xs text-muted-foreground">Deliveries</p>
                          <p className="font-semibold text-foreground">{livePerf.totalDelivered}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rush Jobs</p>
                          <p className="font-semibold text-foreground">{livePerf.rushJobs}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Avg Delivery Time</p>
                          <p className="font-semibold text-foreground">{formatMins(livePerf.avgMins)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Rush SLA ({settings.rushSlaMins ?? 45}m)</p>
                          <p className={`font-semibold ${getSlaColor(livePerf.rushSlaRate)}`}>
                            {livePerf.rushSlaRate !== null ? `${livePerf.rushSlaRate}%` : '—'}
                          </p>
                        </div>
                        {livePerf.totalEarnings > 0 && (
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">Total Pay Recorded</p>
                            <p className="font-semibold text-green-400">${livePerf.totalEarnings.toFixed(2)}</p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* ── Manage tab ────────────────────────────────────────── */}
                <TabsContent value="manage" className="mt-4 space-y-4">

                  {/* Duty status */}
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground">Duty Status</CardTitle>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                      <Button
                        size="sm"
                        variant={selectedDriver.status === 'available' ? 'default' : 'outline'}
                        onClick={() => setDriverDutyStatus(selectedDriver.id, 'available')}
                        className={selectedDriver.status === 'available' ? 'bg-green-600 hover:bg-green-700 flex-1' : 'flex-1'}
                      >
                        <ToggleRight className="w-4 h-4 mr-1.5" />
                        Available
                      </Button>
                      <Button
                        size="sm"
                        variant={selectedDriver.status === 'off_duty' ? 'default' : 'outline'}
                        onClick={() => setDriverDutyStatus(selectedDriver.id, 'off_duty')}
                        className={selectedDriver.status === 'off_duty' ? 'bg-muted flex-1' : 'flex-1'}
                      >
                        <ToggleLeft className="w-4 h-4 mr-1.5" />
                        Off Duty
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Job capacity override */}
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground flex items-center gap-2">
                        <Package className="w-4 h-4" />
                        Job Capacity Override
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Default: {settings.globalMaxJobs ?? 3} jobs. Set a custom limit for this driver, or leave empty to use the default.
                      </p>
                      <div className="flex gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={99}
                          placeholder={`Default (${settings.globalMaxJobs ?? 3})`}
                          value={editCapacity}
                          onChange={e => setEditCapacity(e.target.value)}
                          className="bg-[var(--bg-card)] border-[var(--border-color)] h-9 w-28"
                        />
                        <Button
                          size="sm"
                          onClick={handleSaveCapacity}
                          disabled={isSavingCapacity}
                          className="bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 h-9"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {isSavingCapacity ? 'Saving...' : 'Set'}
                        </Button>
                        {selectedDriver.max_jobs_override !== null && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditCapacity('')
                              handleSaveCapacity()
                            }}
                            className="h-9 text-xs text-muted-foreground"
                          >
                            Reset
                          </Button>
                        )}
                      </div>
                      {selectedDriver.max_jobs_override !== null && (
                        <p className="text-xs text-[var(--accent-orange)]">
                          Currently overridden: {selectedDriver.max_jobs_override} jobs
                        </p>
                      )}
                    </CardContent>
                  </Card>

                  {/* Monthly pay adjustment */}
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground flex items-center gap-2">
                        <DollarSign className="w-4 h-4" />
                        Monthly Pay Adjustment
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-xs text-muted-foreground">
                        Add a monthly bonus or deduction. Negative values are deductions.
                        {selectedDriver.monthly_adjustments !== 0 && (
                          <span className={(selectedDriver.monthly_adjustments ?? 0) > 0 ? ' text-green-400' : ' text-red-400'}>
                            {' '}Current: ${(selectedDriver.monthly_adjustments ?? 0) > 0 ? '+' : ''}{(selectedDriver.monthly_adjustments ?? 0).toFixed(2)}
                          </span>
                        )}
                      </p>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                          <Input
                            type="number"
                            step={0.01}
                            placeholder="0.00"
                            value={editAdjustment}
                            onChange={e => setEditAdjustment(e.target.value)}
                            className="bg-[var(--bg-card)] border-[var(--border-color)] h-9 pl-7"
                          />
                        </div>
                        <Button
                          size="sm"
                          onClick={handleSaveAdjustment}
                          disabled={isSavingAdjustment || editAdjustment.trim() === ''}
                          className="bg-[var(--accent-orange)] hover:bg-[var(--accent-orange)]/90 h-9"
                        >
                          <Save className="w-4 h-4 mr-1" />
                          {isSavingAdjustment ? 'Saving...' : 'Apply'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  <Separator className="bg-[var(--border-color)]" />

                  {/* Account status */}
                  <Card className="bg-[var(--bg-card-2)] border-[var(--border-color)]">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm text-foreground">Account Status</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedDriver.invite_status === 'active' ? (
                        <Button
                          variant="outline"
                          className="w-full border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/10"
                          onClick={() => setInviteStatus(selectedDriver.id, 'deactivated')}
                        >
                          <MinusCircle className="w-4 h-4 mr-2" />
                          Deactivate Driver
                        </Button>
                      ) : (
                        <Button
                          className="w-full bg-green-600 hover:bg-green-700"
                          onClick={() => setInviteStatus(selectedDriver.id, 'active')}
                        >
                          <PlusCircle className="w-4 h-4 mr-2" />
                          {selectedDriver.invite_status === 'deactivated' ? 'Reactivate Driver' : 'Activate Driver'}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        className="w-full gap-2"
                        onClick={() => setShowDeleteConfirm(true)}
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Permanently
                      </Button>
                      <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                        Deactivate preserves history. Delete is only allowed for drivers with no deliveries.
                      </p>
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* ── History tab ────────────────────────────────────────── */}
                <TabsContent value="history" className="mt-4 space-y-2">
                  {driverHistory.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No delivery history</p>
                  ) : (
                    <>
                      <p className="text-xs text-muted-foreground mb-2">
                        Showing last {Math.min(driverHistory.length, 50)} deliveries
                      </p>
                      {driverHistory.slice(0, 50).map((delivery: DbDelivery) => {
                        const delivMins =
                          delivery.picked_up_at && delivery.delivered_at
                            ? Math.round(
                                (new Date(delivery.delivered_at).getTime() -
                                  new Date(delivery.picked_up_at).getTime()) /
                                  60000,
                              )
                            : null
                        return (
                          <div key={delivery.id} className="p-3 rounded-lg bg-[var(--bg-card-2)] space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-foreground">
                                {(delivery as any).business?.name || 'Unknown'}
                              </span>
                              <div className="flex items-center gap-2">
                                {delivery.is_rush && (
                                  <Badge variant="outline" className="text-[10px] border-[var(--accent-orange)]/40 text-[var(--accent-orange)]">
                                    Rush
                                  </Badge>
                                )}
                                <Badge variant="outline" className="text-xs capitalize">
                                  {delivery.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground">{delivery.dropoff_area}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {delivery.delivered_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {new Date(delivery.delivered_at).toLocaleDateString()}
                                </span>
                              )}
                              {delivMins !== null && (
                                <span className="flex items-center gap-1">
                                  <Award className="w-3 h-3" />
                                  {formatMins(delivMins)}
                                </span>
                              )}
                              {(delivery.pickup_pay || delivery.delivery_pay) && (
                                <span className="text-green-400 ml-auto">
                                  ${((delivery.pickup_pay ?? 0) + (delivery.delivery_pay ?? 0)).toFixed(2)}
                                </span>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </>
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Delete Confirmation ──────────────────────────────────────────── */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-[var(--bg-card)] border-[var(--border-color)]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {selectedDriver?.name} permanently?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the driver&apos;s login and record completely. It will fail if the driver
              has any delivery history — use Deactivate to preserve historical records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDriver}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete Permanently'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
