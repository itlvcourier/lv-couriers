'use client'

import { useCallback, useEffect, useState } from 'react'
import { useApp } from '@/lib/context'
import { useFeatureFlag } from '@/lib/hooks/useFeatureFlag'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import {
  ArrowLeftRight,
  ArrowUpRight,
  ArrowDownLeft,
  Package,
  Check,
  X,
  Loader2,
  ShieldAlert,
  Copy,
  CheckCircle2,
} from 'lucide-react'
import {
  initiateTransfer,
  acceptTransfer,
  rejectTransfer,
  cancelTransfer,
  listOutgoingTransfers,
  listIncomingTransfers,
  getTransferByCode,
  getTransferItems,
  type DriverTransfer,
  type TransferItem,
} from '@/lib/driver-transfers'
import { getCurrentPosition } from '@/lib/native/geolocation'
import { toast } from 'sonner'

async function safeLocation(): Promise<{ lat: number; lng: number } | null> {
  try {
    const pos = await getCurrentPosition()
    return { lat: pos.lat, lng: pos.lng }
  } catch {
    return null
  }
}

type Mode = 'menu' | 'send' | 'receive'

export function DriverTransfersScreen() {
  const { currentUser, drivers, deliveries } = useApp()
  const transfersEnabled = useFeatureFlag('driver_transfers_enabled')
  const requiresAdminFlag = useFeatureFlag('transfer_requires_admin')
  const driverId = currentUser?.driverId || ''

  const [mode, setMode] = useState<Mode>('menu')

  // Custody flips touch the global delivery list; the app hydrates that list on
  // load, so after a successful transfer we re-hydrate via a soft reload.
  const reloadApp = useCallback(() => {
    if (typeof window !== 'undefined') window.location.reload()
  }, [])

  if (!transfersEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <ArrowLeftRight className="w-10 h-10 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Driver-to-driver transfers are turned off for your operation.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ArrowLeftRight className="w-5 h-5 text-[var(--accent-orange)]" />
        <h1 className="text-lg font-bold text-foreground">Transfers</h1>
      </div>

      {mode === 'menu' && (
        <TransfersMenu driverId={driverId} onSelect={setMode} />
      )}
      {mode === 'send' && (
        <SendTransfer
          driverId={driverId}
          drivers={drivers.filter((d) => d.id !== driverId)}
          deliveries={deliveries.filter(
            (d) =>
              d.driverId === driverId &&
              !['delivered', 'failed_permanent', 'cancelled'].includes(d.status),
          )}
          requiresAdmin={Boolean(requiresAdminFlag)}
          onBack={() => setMode('menu')}
          onDone={() => {
            reloadApp()
            setMode('menu')
          }}
        />
      )}
      {mode === 'receive' && (
        <ReceiveTransfer
          driverId={driverId}
          onBack={() => setMode('menu')}
          onAccepted={() => {
            reloadApp()
            setMode('menu')
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Menu + pending lists
// ---------------------------------------------------------------------------

function TransfersMenu({
  driverId,
  onSelect,
}: {
  driverId: string
  onSelect: (m: Mode) => void
}) {
  const [incoming, setIncoming] = useState<DriverTransfer[]>([])
  const [outgoing, setOutgoing] = useState<DriverTransfer[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!driverId) return
    try {
      const [inc, out] = await Promise.all([
        listIncomingTransfers(driverId),
        listOutgoingTransfers(driverId),
      ])
      setIncoming(inc)
      setOutgoing(out)
    } catch (err) {
      console.error('[v0] load transfers error:', err)
    } finally {
      setLoading(false)
    }
  }, [driverId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSelect('send')}
          className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 tap-target"
        >
          <ArrowUpRight className="w-6 h-6 text-[var(--accent-blue)]" />
          <span className="text-sm font-medium text-foreground">Hand off parcels</span>
        </button>
        <button
          onClick={() => onSelect('receive')}
          className="flex flex-col items-center gap-2 rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 tap-target"
        >
          <ArrowDownLeft className="w-6 h-6 text-[var(--accent-green)]" />
          <span className="text-sm font-medium text-foreground">Receive parcels</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {incoming.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Waiting for you ({incoming.length})
              </h2>
              {incoming.map((t) => (
                <TransferRow key={t.id} transfer={t} tone="incoming" />
              ))}
            </section>
          )}
          {outgoing.filter((t) => t.status === 'pending').length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your pending hand-offs
              </h2>
              {outgoing
                .filter((t) => t.status === 'pending')
                .map((t) => (
                  <TransferRow key={t.id} transfer={t} tone="outgoing" />
                ))}
            </section>
          )}
        </>
      )}
    </div>
  )
}

function TransferRow({
  transfer,
  tone,
}: {
  transfer: DriverTransfer
  tone: 'incoming' | 'outgoing'
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground truncate">
          {tone === 'incoming' ? `From ${transfer.fromDriverName ?? 'driver'}` : transfer.transferCode}
        </p>
        <p className="text-xs text-muted-foreground">
          {transfer.itemCount} parcel{transfer.itemCount === 1 ? '' : 's'}
          {transfer.requiresAdmin && transfer.adminStatus !== 'approved'
            ? ' · awaiting admin'
            : ''}
        </p>
      </div>
      <span className="font-mono text-xs text-muted-foreground shrink-0">
        {tone === 'incoming' ? transfer.transferCode : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Send (hand off)
// ---------------------------------------------------------------------------

function SendTransfer({
  driverId,
  drivers,
  deliveries,
  requiresAdmin,
  onBack,
  onDone,
}: {
  driverId: string
  drivers: { id: string; name: string }[]
  deliveries: {
    id: string
    recipientName?: string | null
    dropoffAddress: string
    dropoffArea: string
  }[]
  requiresAdmin: boolean
  onBack: () => void
  onDone: () => void
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [toDriverId, setToDriverId] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [created, setCreated] = useState<DriverTransfer | null>(null)
  const [copied, setCopied] = useState(false)

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async () => {
    if (selected.size === 0) {
      toast.error('Select at least one parcel')
      return
    }
    setSubmitting(true)
    try {
      const loc = await safeLocation()
      const transfer = await initiateTransfer({
        fromDriverId: driverId,
        deliveryIds: Array.from(selected),
        toDriverId: toDriverId || null,
        requiresAdmin,
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
      })
      setCreated(transfer)
      toast.success('Transfer created')
    } catch (err) {
      console.error('[v0] initiate transfer error:', err)
      toast.error('Could not create transfer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    if (!created) return
    try {
      await cancelTransfer(created.id)
      toast.success('Transfer cancelled')
      onDone()
    } catch {
      toast.error('Could not cancel')
    }
  }

  if (created) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-5 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-[var(--accent-green)] mx-auto" />
          <div>
            <p className="text-sm text-muted-foreground">Share this code with the receiving driver</p>
            <p className="text-3xl font-bold font-mono tracking-widest text-foreground mt-1">
              {created.transferCode}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard?.writeText(created.transferCode)
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            className="gap-2"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy code'}
          </Button>
          {created.requiresAdmin && (
            <p className="flex items-center justify-center gap-1.5 text-xs text-[var(--accent-orange)]">
              <ShieldAlert className="w-3.5 h-3.5" />
              Needs admin approval before it can be accepted
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {created.itemCount} parcel{created.itemCount === 1 ? '' : 's'} will move once accepted.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={handleCancel}>
            Cancel transfer
          </Button>
          <Button className="flex-1" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        Back
      </Button>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Receiving driver (optional)
        </label>
        <Select value={toDriverId} onValueChange={setToDriverId}>
          <SelectTrigger className="bg-[var(--bg-card)] border-[var(--border-color)]">
            <SelectValue placeholder="Anyone with the code" />
          </SelectTrigger>
          <SelectContent>
            {drivers.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">
          Select parcels to hand off
        </p>
        {deliveries.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            You have no active parcels to transfer.
          </p>
        ) : (
          deliveries.map((d) => (
            <label
              key={d.id}
              className="flex items-start gap-3 rounded-lg border border-[var(--border-color)] bg-[var(--bg-card)] px-3 py-2.5 cursor-pointer"
            >
              <Checkbox
                checked={selected.has(d.id)}
                onCheckedChange={() => toggle(d.id)}
                className="mt-0.5"
              />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {d.recipientName || 'Recipient'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {d.dropoffAddress}
                  {d.dropoffArea ? ` · ${d.dropoffArea}` : ''}
                </p>
              </div>
            </label>
          ))
        )}
      </div>

      <Button
        className="w-full"
        disabled={submitting || selected.size === 0}
        onClick={handleSubmit}
      >
        {submitting ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <Package className="w-4 h-4 mr-2" />
            Create transfer ({selected.size})
          </>
        )}
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Receive (accept)
// ---------------------------------------------------------------------------

function ReceiveTransfer({
  driverId,
  onBack,
  onAccepted,
}: {
  driverId: string
  onBack: () => void
  onAccepted: () => void
}) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [transfer, setTransfer] = useState<DriverTransfer | null>(null)
  const [items, setItems] = useState<TransferItem[]>([])
  const [accepting, setAccepting] = useState(false)

  const lookup = async () => {
    if (!code.trim()) return
    setLoading(true)
    setTransfer(null)
    try {
      const t = await getTransferByCode(code)
      if (!t) {
        toast.error('No transfer found for that code')
        return
      }
      if (t.status !== 'pending') {
        toast.error(`This transfer is already ${t.status}`)
        return
      }
      if (t.fromDriverId === driverId) {
        toast.error('You cannot accept your own transfer')
        return
      }
      const its = await getTransferItems(t.id)
      setTransfer(t)
      setItems(its)
    } catch (err) {
      console.error('[v0] lookup transfer error:', err)
      toast.error('Could not look up transfer')
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async () => {
    if (!transfer) return
    if (transfer.requiresAdmin && transfer.adminStatus !== 'approved') {
      toast.error('This transfer is still waiting for admin approval')
      return
    }
    setAccepting(true)
    try {
      const loc = await safeLocation()
      const moved = await acceptTransfer({
        transferId: transfer.id,
        acceptingDriverId: driverId,
        scanMethod: 'manual',
        lat: loc?.lat ?? null,
        lng: loc?.lng ?? null,
      })
      toast.success(`${moved} parcel${moved === 1 ? '' : 's'} now in your custody`)
      onAccepted()
    } catch (err) {
      console.error('[v0] accept transfer error:', err)
      toast.error('Could not accept transfer')
    } finally {
      setAccepting(false)
    }
  }

  const handleReject = async () => {
    if (!transfer) return
    try {
      await rejectTransfer(transfer.id)
      toast.success('Transfer rejected')
      setTransfer(null)
      setCode('')
    } catch {
      toast.error('Could not reject')
    }
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="-ml-2">
        Back
      </Button>

      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Transfer code</label>
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="TX-XXXXXX"
            className="font-mono uppercase bg-[var(--bg-card)] border-[var(--border-color)]"
            onKeyDown={(e) => e.key === 'Enter' && lookup()}
          />
          <Button onClick={lookup} disabled={loading || !code.trim()}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Find'}
          </Button>
        </div>
      </div>

      {transfer && (
        <div className="space-y-3">
          <div className="rounded-xl border border-[var(--border-color)] bg-[var(--bg-card)] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">
                  From {transfer.fromDriverName ?? 'driver'}
                </p>
                <p className="text-xs text-muted-foreground">
                  {items.length} parcel{items.length === 1 ? '' : 's'}
                </p>
              </div>
              {transfer.requiresAdmin && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    transfer.adminStatus === 'approved'
                      ? 'text-[var(--accent-green)]'
                      : 'text-[var(--accent-orange)]'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  {transfer.adminStatus === 'approved' ? 'Approved' : 'Awaiting admin'}
                </span>
              )}
            </div>
            <div className="space-y-1.5 border-t border-[var(--border-color)] pt-3">
              {items.map((it) => (
                <div key={it.deliveryId} className="flex items-start gap-2">
                  <Package className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground truncate">
                      {it.recipientName || 'Recipient'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {it.dropoffAddress}
                      {it.dropoffArea ? ` · ${it.dropoffArea}` : ''}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="ghost" className="flex-1 text-[var(--accent-red)]" onClick={handleReject}>
              <X className="w-4 h-4 mr-1" />
              Reject
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={
                accepting ||
                (transfer.requiresAdmin && transfer.adminStatus !== 'approved')
              }
            >
              {accepting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Accept
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
