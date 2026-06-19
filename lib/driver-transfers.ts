'use client'

import { createClient } from '@/lib/supabase/client'
import { ORG_ID } from '@/lib/feature-settings'

// ============================================================================
// Phase 5 — Driver-to-driver transfers.
//
// A driver hands part (or all) of their custody to another driver. The flow:
//   1. The handing-off driver selects parcels and initiates a transfer. This
//      generates a short scannable transfer_code.
//   2. The receiving driver scans/enters the code and accepts. Acceptance is
//      atomic (accept_driver_transfer RPC): every parcel's custody flips to
//      the new driver, a transfer_in custody event is logged per parcel, and
//      each delivery is reassigned + set to leg_status='out_for_delivery'.
//   3. If transfers require admin approval, the transfer waits for an admin to
//      approve before the receiving driver can accept.
//
// Each parcel still carries its own dropoff zone, so the receiving driver's
// route is re-planned by the existing zone/route logic once custody flips.
// ============================================================================

export type TransferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled'
export type AdminStatus = 'pending' | 'approved' | 'rejected'

export interface TransferItem {
  deliveryId: string
  status: string
  recipientName: string | null
  dropoffAddress: string | null
  dropoffArea: string | null
  scanToken: string | null
}

export interface DriverTransfer {
  id: string
  transferCode: string
  fromDriverId: string
  fromDriverName: string | null
  toDriverId: string | null
  toDriverName: string | null
  status: TransferStatus
  requiresAdmin: boolean
  adminStatus: AdminStatus | null
  note: string | null
  initiatedAt: string
  decidedAt: string | null
  itemCount: number
  items?: TransferItem[]
}

type TransferRow = {
  id: string
  transfer_code: string
  from_driver_id: string
  to_driver_id: string | null
  status: TransferStatus
  requires_admin: boolean
  admin_status: AdminStatus | null
  note: string | null
  initiated_at: string
  decided_at: string | null
  from_driver?: { name: string | null } | null
  to_driver?: { name: string | null } | null
  driver_transfer_items?: { count: number }[] | null
}

function mapTransfer(r: TransferRow): DriverTransfer {
  return {
    id: r.id,
    transferCode: r.transfer_code,
    fromDriverId: r.from_driver_id,
    fromDriverName: r.from_driver?.name ?? null,
    toDriverId: r.to_driver_id,
    toDriverName: r.to_driver?.name ?? null,
    status: r.status,
    requiresAdmin: r.requires_admin,
    adminStatus: r.admin_status,
    note: r.note,
    initiatedAt: r.initiated_at,
    decidedAt: r.decided_at,
    itemCount: r.driver_transfer_items?.[0]?.count ?? 0,
  }
}

const TRANSFER_COLUMNS =
  'id, transfer_code, from_driver_id, to_driver_id, status, requires_admin, admin_status, note, initiated_at, decided_at, from_driver:drivers!driver_transfers_from_driver_id_fkey(name), to_driver:drivers!driver_transfers_to_driver_id_fkey(name), driver_transfer_items(count)'

/** Generate a short, human-readable, scannable transfer code. */
function generateTransferCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = 'TX-'
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

// ---------------------------------------------------------------------------
// Initiation
// ---------------------------------------------------------------------------

/**
 * Initiate a transfer of the given deliveries from one driver. Returns the
 * created transfer (including its scannable code). The parcels are NOT moved
 * until the receiving driver accepts.
 */
export async function initiateTransfer(input: {
  fromDriverId: string
  deliveryIds: string[]
  toDriverId?: string | null
  note?: string | null
  requiresAdmin?: boolean
  lat?: number | null
  lng?: number | null
}): Promise<DriverTransfer> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  if (input.deliveryIds.length === 0) throw new Error('Select at least one parcel to transfer')

  const code = generateTransferCode()
  const { data: transfer, error } = await supabase
    .from('driver_transfers')
    .insert({
      org_id: ORG_ID,
      transfer_code: code,
      from_driver_id: input.fromDriverId,
      to_driver_id: input.toDriverId ?? null,
      status: 'pending',
      requires_admin: input.requiresAdmin ?? false,
      admin_status: input.requiresAdmin ? 'pending' : null,
      note: input.note ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
    })
    .select('id, transfer_code')
    .single()
  if (error) {
    // §8 Server-side enforcement: a stale client may still show the transfer
    // action after an admin disables it. Surface a readable message.
    if (error.message?.includes('driver_transfers_disabled')) {
      throw new Error('Driver-to-driver transfers are currently turned off.')
    }
    throw error
  }

  const items = input.deliveryIds.map((deliveryId) => ({
    org_id: ORG_ID,
    transfer_id: transfer.id,
    delivery_id: deliveryId,
    status: 'pending',
  }))
  const { error: itemError } = await supabase.from('driver_transfer_items').insert(items)
  if (itemError) throw itemError

  // Mark each delivery as pending a custody change for visibility.
  await supabase
    .from('deliveries')
    .update({ address_change_pending: false })
    .in('id', input.deliveryIds)

  const created = await getTransfer(transfer.id)
  if (!created) throw new Error('Failed to load created transfer')
  return created
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getTransfer(id: string): Promise<DriverTransfer | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('driver_transfers')
    .select(TRANSFER_COLUMNS)
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  return data ? mapTransfer(data as TransferRow) : null
}

export async function getTransferByCode(code: string): Promise<DriverTransfer | null> {
  const supabase = createClient()
  if (!supabase) return null
  const { data, error } = await supabase
    .from('driver_transfers')
    .select(TRANSFER_COLUMNS)
    .eq('transfer_code', code.trim().toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data ? mapTransfer(data as TransferRow) : null
}

/** Load the parcels attached to a transfer, with recipient/address detail. */
export async function getTransferItems(transferId: string): Promise<TransferItem[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('driver_transfer_items')
    .select(
      'status, delivery:deliveries(id, recipient_name, dropoff_address, dropoff_area, scan_token)',
    )
    .eq('transfer_id', transferId)
  if (error) throw error
  return (data as any[]).map((row) => ({
    deliveryId: row.delivery?.id,
    status: row.status,
    recipientName: row.delivery?.recipient_name ?? null,
    dropoffAddress: row.delivery?.dropoff_address ?? null,
    dropoffArea: row.delivery?.dropoff_area ?? null,
    scanToken: row.delivery?.scan_token ?? null,
  }))
}

/** Transfers a driver initiated (outgoing). */
export async function listOutgoingTransfers(driverId: string): Promise<DriverTransfer[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('driver_transfers')
    .select(TRANSFER_COLUMNS)
    .eq('from_driver_id', driverId)
    .order('initiated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data as TransferRow[]).map(mapTransfer)
}

/** Pending transfers addressed to a driver, or open (unaddressed) transfers. */
export async function listIncomingTransfers(driverId: string): Promise<DriverTransfer[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('driver_transfers')
    .select(TRANSFER_COLUMNS)
    .eq('status', 'pending')
    .or(`to_driver_id.eq.${driverId},to_driver_id.is.null`)
    .order('initiated_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data as TransferRow[])
    .map(mapTransfer)
    .filter((t) => t.fromDriverId !== driverId)
}

/** All transfers for the admin oversight board. */
export async function listAllTransfers(limit = 100): Promise<DriverTransfer[]> {
  const supabase = createClient()
  if (!supabase) return []
  const { data, error } = await supabase
    .from('driver_transfers')
    .select(TRANSFER_COLUMNS)
    .order('initiated_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data as TransferRow[]).map(mapTransfer)
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/**
 * Accept a transfer. Atomically flips custody of every parcel to the accepting
 * driver via the accept_driver_transfer RPC. Returns the number of parcels moved.
 */
export async function acceptTransfer(input: {
  transferId: string
  acceptingDriverId: string
  scanMethod?: string
  lat?: number | null
  lng?: number | null
}): Promise<number> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const { data, error } = await supabase.rpc('accept_driver_transfer', {
    p_transfer_id: input.transferId,
    p_accepting_driver_id: input.acceptingDriverId,
    p_lat: input.lat ?? null,
    p_lng: input.lng ?? null,
    p_scan_method: input.scanMethod ?? 'qr',
  })
  if (error) throw error
  return (data as number) ?? 0
}

export async function rejectTransfer(transferId: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const { error } = await supabase
    .from('driver_transfers')
    .update({ status: 'rejected', decided_at: new Date().toISOString() })
    .eq('id', transferId)
    .eq('status', 'pending')
  if (error) throw error
}

export async function cancelTransfer(transferId: string): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const { error } = await supabase
    .from('driver_transfers')
    .update({ status: 'cancelled', decided_at: new Date().toISOString() })
    .eq('id', transferId)
    .eq('status', 'pending')
  if (error) throw error
}

/** Admin approves/rejects a transfer that requires approval. */
export async function setTransferAdminStatus(input: {
  transferId: string
  adminStatus: AdminStatus
  approvedBy?: string | null
}): Promise<void> {
  const supabase = createClient()
  if (!supabase) throw new Error('Supabase client unavailable')
  const patch: Record<string, unknown> = {
    admin_status: input.adminStatus,
    approved_by: input.approvedBy ?? null,
  }
  // A hard admin rejection also kills the transfer.
  if (input.adminStatus === 'rejected') {
    patch.status = 'rejected'
    patch.decided_at = new Date().toISOString()
  }
  const { error } = await supabase
    .from('driver_transfers')
    .update(patch)
    .eq('id', input.transferId)
  if (error) throw error
}
