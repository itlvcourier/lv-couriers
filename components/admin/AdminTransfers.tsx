'use client'

import { useCallback, useEffect, useState } from 'react'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { useApp } from '@/lib/context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  ArrowLeftRight,
  Check,
  X,
  Loader2,
  ShieldAlert,
  RefreshCw,
  Search,
  ChevronDown,
  ChevronUp,
  Package,
  Clock,
} from 'lucide-react'
import {
  listAllTransfers,
  setTransferAdminStatus,
  rejectTransfer,
  cancelTransfer,
  getTransferItems,
  type DriverTransfer,
  type TransferStatus,
  type TransferItem,
} from '@/lib/driver-transfers'
import { toast } from 'sonner'
import { format } from 'date-fns'

const STATUS_TONE: Record<TransferStatus, string> = {
  pending: 'bg-[var(--accent-orange)]/15 text-[var(--accent-orange)] border-[var(--accent-orange)]/30',
  accepted: 'bg-[var(--accent-green)]/15 text-[var(--accent-green)] border-[var(--accent-green)]/30',
  rejected: 'bg-[var(--accent-red)]/15 text-[var(--accent-red)] border-[var(--accent-red)]/30',
  cancelled: 'bg-muted/50 text-muted-foreground border-border',
}

const STATUS_LABEL: Record<TransferStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export function AdminTransfers() {
  const transfersEnabled = useFeatureFlag('driver_transfers_enabled')
  const { currentUser } = useApp()
  const [transfers, setTransfers] = useState<DriverTransfer[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | TransferStatus>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [itemsCache, setItemsCache] = useState<Record<string, TransferItem[]>>({})

  const load = useCallback(async () => {
    try {
      setTransfers(await listAllTransfers(200))
    } catch (err) {
      console.error('Admin transfers load error:', err)
      toast.error('Could not load transfers')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const toggleExpand = async (transferId: string) => {
    if (expandedId === transferId) {
      setExpandedId(null)
      return
    }
    setExpandedId(transferId)
    if (!itemsCache[transferId]) {
      try {
        const items = await getTransferItems(transferId)
        setItemsCache(prev => ({ ...prev, [transferId]: items }))
      } catch {
        // silently ignore
      }
    }
  }

  const adminDecide = async (transfer: DriverTransfer, adminStatus: 'approved' | 'rejected') => {
    setBusyId(transfer.id)
    try {
      await setTransferAdminStatus({
        transferId: transfer.id,
        adminStatus,
        approvedBy: currentUser?.id ?? null,
      })
      toast.success(adminStatus === 'approved' ? 'Transfer approved' : 'Transfer rejected')
      await load()
    } catch (err) {
      console.error('Admin decide transfer error:', err)
      toast.error('Could not update transfer')
    } finally {
      setBusyId(null)
    }
  }

  const adminReject = async (transfer: DriverTransfer) => {
    setBusyId(transfer.id)
    try {
      await rejectTransfer(transfer.id)
      toast.success('Transfer rejected')
      await load()
    } catch (err) {
      console.error('Admin reject transfer error:', err)
      toast.error('Could not reject transfer')
    } finally {
      setBusyId(null)
    }
  }

  const adminCancel = async (transfer: DriverTransfer) => {
    setBusyId(transfer.id)
    try {
      await cancelTransfer(transfer.id)
      toast.success('Transfer cancelled')
      await load()
    } catch (err) {
      console.error('Admin cancel transfer error:', err)
      toast.error('Could not cancel transfer')
    } finally {
      setBusyId(null)
    }
  }

  if (!transfersEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <ArrowLeftRight className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Driver-to-driver transfers are turned off. Enable them in Settings to see this board.
        </p>
      </div>
    )
  }

  const awaitingApproval = transfers.filter(
    (t) =>
      t.status === 'pending' &&
      t.requiresAdmin &&
      t.adminStatus !== 'approved' &&
      t.adminStatus !== 'rejected',
  )

  const filtered = transfers.filter(t => {
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter
    const q = search.toLowerCase()
    const matchesSearch =
      !q ||
      (t.fromDriverName ?? '').toLowerCase().includes(q) ||
      (t.toDriverName ?? '').toLowerCase().includes(q) ||
      t.transferCode.toLowerCase().includes(q)
    return matchesStatus && matchesSearch
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="w-5 h-5 text-[var(--accent-orange)]" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Driver Transfers</h1>
            <p className="text-xs text-muted-foreground">{transfers.length} total</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={load} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Awaiting approval banner */}
      {awaitingApproval.length > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-[var(--accent-orange)]/40 bg-[var(--accent-orange)]/5 px-4 py-3">
          <ShieldAlert className="w-5 h-5 text-[var(--accent-orange)] shrink-0" />
          <p className="text-sm text-[var(--accent-orange)] font-medium">
            {awaitingApproval.length} transfer{awaitingApproval.length > 1 ? 's need' : ' needs'} your admin approval
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by driver or code..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-[var(--bg-card)] border-[var(--border-color)]"
          />
        </div>
        <div className="flex gap-1.5">
          {(['all', 'pending', 'accepted', 'rejected', 'cancelled'] as const).map(s => (
            <Button
              key={s}
              size="sm"
              variant={statusFilter === s ? 'secondary' : 'outline'}
              onClick={() => setStatusFilter(s)}
              className="capitalize text-xs"
            >
              {s}
              {s !== 'all' && (
                <span className="ml-1 text-[10px] opacity-70">
                  {transfers.filter(t => t.status === s).length}
                </span>
              )}
            </Button>
          ))}
        </div>
      </div>

      {/* Transfers list */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-12 text-center">No transfers match your filters.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((t) => {
            const isExpanded = expandedId === t.id
            const items = itemsCache[t.id] ?? []
            const isBusy = busyId === t.id
            const needsAdminApproval =
              t.status === 'pending' &&
              t.requiresAdmin &&
              t.adminStatus !== 'approved' &&
              t.adminStatus !== 'rejected'
            const isPending = t.status === 'pending'

            return (
              <div
                key={t.id}
                className={`rounded-lg border bg-[var(--bg-card)] transition-colors ${
                  needsAdminApproval
                    ? 'border-[var(--accent-orange)]/40'
                    : 'border-[var(--border-color)]'
                }`}
              >
                {/* Main row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Transfer info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                        {t.transferCode}
                      </span>
                      <span className="text-sm text-foreground">
                        {t.fromDriverName ?? 'Driver'} → {t.toDriverName ?? 'Open'}
                      </span>
                      <Badge variant="outline" className={`text-xs border ${STATUS_TONE[t.status]}`}>
                        {STATUS_LABEL[t.status]}
                      </Badge>
                      {needsAdminApproval && (
                        <Badge variant="outline" className="text-xs border border-[var(--accent-orange)]/30 text-[var(--accent-orange)] bg-[var(--accent-orange)]/10">
                          <ShieldAlert className="w-3 h-3 mr-1" />
                          Needs approval
                        </Badge>
                      )}
                      {t.adminStatus && t.adminStatus !== 'pending' && (
                        <span className="text-xs text-muted-foreground">
                          admin: {t.adminStatus}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        {t.itemCount} parcel{t.itemCount !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {format(new Date(t.initiatedAt), 'MMM d, h:mm a')}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {/* Expand parcels */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-muted-foreground"
                      onClick={() => toggleExpand(t.id)}
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </Button>

                    {/* Admin approval buttons (requires_admin transfers) */}
                    {needsAdminApproval && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[var(--accent-red)] hover:bg-[var(--accent-red)]/10"
                          disabled={isBusy}
                          onClick={() => adminDecide(t, 'rejected')}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          className="h-7 px-3 bg-[var(--accent-green)] hover:bg-[var(--accent-green)]/90 text-black text-xs"
                          disabled={isBusy}
                          onClick={() => adminDecide(t, 'approved')}
                        >
                          {isBusy ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <Check className="w-3 h-3 mr-1" />
                              Approve
                            </>
                          )}
                        </Button>
                      </>
                    )}

                    {/* Plain pending (no admin requirement) — admin can still reject/cancel */}
                    {isPending && !needsAdminApproval && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-[var(--accent-red)] border-[var(--accent-red)]/30 hover:bg-[var(--accent-red)]/10 text-xs"
                          disabled={isBusy}
                          onClick={() => adminReject(t)}
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Reject'}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-muted-foreground text-xs"
                          disabled={isBusy}
                          onClick={() => adminCancel(t)}
                        >
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded parcels */}
                {isExpanded && (
                  <div className="border-t border-[var(--border-color)] px-4 pb-3 pt-2 space-y-1.5">
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">Loading parcels...</p>
                    ) : (
                      items.map((item, idx) => (
                        <div key={item.deliveryId ?? idx} className="flex items-start gap-3 text-xs">
                          <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-muted-foreground shrink-0">
                            {item.scanToken ?? '—'}
                          </span>
                          <span className="text-foreground">{item.recipientName ?? 'Recipient'}</span>
                          <span className="text-muted-foreground truncate ml-auto">
                            {item.dropoffArea ?? item.dropoffAddress ?? '—'}
                          </span>
                        </div>
                      ))
                    )}
                    {t.note && (
                      <p className="text-xs text-muted-foreground mt-1 pt-1 border-t border-[var(--border-color)] italic">
                        Note: {t.note}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
