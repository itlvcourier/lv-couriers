import { createClient } from "@/lib/supabase/client"

export const ORG_ID = "00000000-0000-0000-0000-000000000001"

export type DispatchRequestType =
  | "late_order"
  | "address_change"
  | "cancel"
  | "transfer"
  | "redelivery"

export type DispatchRequestStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired"
  | "auto_approved"
  | "cancelled"

export type RequesterRole = "business" | "driver" | "admin" | "system"

export interface DispatchRequest {
  id: string
  type: DispatchRequestType
  businessId: string | null
  deliveryId: string | null
  payload: Record<string, unknown>
  status: DispatchRequestStatus
  surchargeCode: string | null
  reason: string | null
  requestedBy: string | null
  requestedByRole: RequesterRole | null
  decidedBy: string | null
  expiresAt: string | null
  decidedAt: string | null
  createdAt: string
  updatedAt: string
}

interface DispatchRow {
  id: string
  type: DispatchRequestType
  business_id: string | null
  delivery_id: string | null
  payload: Record<string, unknown> | null
  status: DispatchRequestStatus
  surcharge_code: string | null
  reason: string | null
  requested_by: string | null
  requested_by_role: RequesterRole | null
  decided_by: string | null
  expires_at: string | null
  decided_at: string | null
  created_at: string
  updated_at: string
}

function mapRequest(r: DispatchRow): DispatchRequest {
  return {
    id: r.id,
    type: r.type,
    businessId: r.business_id,
    deliveryId: r.delivery_id,
    payload: r.payload ?? {},
    status: r.status,
    surchargeCode: r.surcharge_code,
    reason: r.reason,
    requestedBy: r.requested_by,
    requestedByRole: r.requested_by_role,
    decidedBy: r.decided_by,
    expiresAt: r.expires_at,
    decidedAt: r.decided_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

export interface CreateDispatchRequestInput {
  type: DispatchRequestType
  businessId?: string | null
  deliveryId?: string | null
  payload?: Record<string, unknown>
  surchargeCode?: string | null
  reason?: string | null
  requestedBy?: string | null
  requestedByRole?: RequesterRole
  /** Minutes until this request auto-expires while pending. */
  expiresInMinutes?: number | null
}

export async function createDispatchRequest(
  input: CreateDispatchRequestInput,
): Promise<DispatchRequest> {
  const supabase = createClient()
  const expiresAt =
    input.expiresInMinutes && input.expiresInMinutes > 0
      ? new Date(Date.now() + input.expiresInMinutes * 60_000).toISOString()
      : null
  const { data, error } = await supabase
    .from("dispatch_requests")
    .insert({
      org_id: ORG_ID,
      type: input.type,
      business_id: input.businessId ?? null,
      delivery_id: input.deliveryId ?? null,
      payload: input.payload ?? {},
      surcharge_code: input.surchargeCode ?? null,
      reason: input.reason ?? null,
      requested_by: input.requestedBy ?? null,
      requested_by_role: input.requestedByRole ?? null,
      expires_at: expiresAt,
      status: "pending",
    })
    .select("*")
    .single()
  if (error) {
    // §8 The server-side enforcement trigger rejects gated writes even if a
    // stale client still shows the action. Surface a readable message.
    if (error.message?.includes("late_requests_disabled")) {
      throw new Error("Late order requests are currently turned off.")
    }
    throw error
  }
  return mapRequest(data as DispatchRow)
}

/** Run the server-side sweep that flips overdue pending requests to expired. */
export async function expireStaleRequests(): Promise<number> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("expire_dispatch_requests")
  if (error) {
    // Non-fatal: fall back to a client-side update so the UI stays correct.
    const nowIso = new Date().toISOString()
    await supabase
      .from("dispatch_requests")
      .update({ status: "expired", decided_at: nowIso })
      .eq("status", "pending")
      .not("expires_at", "is", null)
      .lt("expires_at", nowIso)
    return 0
  }
  return (data as number) ?? 0
}

export interface ListRequestsFilter {
  status?: DispatchRequestStatus | DispatchRequestStatus[]
  type?: DispatchRequestType
  businessId?: string
  deliveryId?: string
  limit?: number
}

/** List dispatch requests. Always expires stale ones first so the queue is honest. */
export async function listDispatchRequests(
  filter: ListRequestsFilter = {},
): Promise<DispatchRequest[]> {
  await expireStaleRequests()
  const supabase = createClient()
  let q = supabase.from("dispatch_requests").select("*").order("created_at", { ascending: false })
  if (filter.status) {
    q = Array.isArray(filter.status) ? q.in("status", filter.status) : q.eq("status", filter.status)
  }
  if (filter.type) q = q.eq("type", filter.type)
  if (filter.businessId) q = q.eq("business_id", filter.businessId)
  if (filter.deliveryId) q = q.eq("delivery_id", filter.deliveryId)
  if (filter.limit) q = q.limit(filter.limit)
  const { data, error } = await q
  if (error) throw error
  return (data as DispatchRow[]).map(mapRequest)
}

export async function getPendingCount(): Promise<number> {
  await expireStaleRequests()
  const supabase = createClient()
  const { count, error } = await supabase
    .from("dispatch_requests")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending")
  if (error) throw error
  return count ?? 0
}

export interface DecisionInput {
  decidedBy?: string | null
  /** Optional patch merged into payload at decision time (e.g. final surcharge). */
  payloadPatch?: Record<string, unknown>
  reason?: string | null
}

async function decide(
  id: string,
  status: Extract<DispatchRequestStatus, "approved" | "rejected" | "cancelled">,
  input: DecisionInput = {},
): Promise<DispatchRequest> {
  const supabase = createClient()
  // Guard: only a still-pending request can be decided (prevents racing an expiry).
  const { data: current, error: readErr } = await supabase
    .from("dispatch_requests")
    .select("*")
    .eq("id", id)
    .single()
  if (readErr) throw readErr
  const cur = current as DispatchRow
  if (cur.status !== "pending") {
    throw new Error(`Request is no longer pending (current status: ${cur.status}).`)
  }
  const mergedPayload = input.payloadPatch
    ? { ...(cur.payload ?? {}), ...input.payloadPatch }
    : cur.payload ?? {}
  const { data, error } = await supabase
    .from("dispatch_requests")
    .update({
      status,
      decided_by: input.decidedBy ?? null,
      decided_at: new Date().toISOString(),
      reason: input.reason ?? cur.reason,
      payload: mergedPayload,
    })
    .eq("id", id)
    .eq("status", "pending")
    .select("*")
    .single()
  if (error) throw error
  return mapRequest(data as DispatchRow)
}

export function approveDispatchRequest(id: string, input?: DecisionInput) {
  return decide(id, "approved", input)
}
export function rejectDispatchRequest(id: string, input?: DecisionInput) {
  return decide(id, "rejected", input)
}
export function cancelDispatchRequest(id: string, input?: DecisionInput) {
  return decide(id, "cancelled", input)
}

export const REQUEST_TYPE_LABELS: Record<DispatchRequestType, string> = {
  late_order: "Late Order",
  address_change: "Address Change",
  cancel: "Cancellation",
  transfer: "Driver Transfer",
  redelivery: "Redelivery",
}

export const REQUEST_STATUS_LABELS: Record<DispatchRequestStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  auto_approved: "Auto-approved",
  cancelled: "Cancelled",
}
