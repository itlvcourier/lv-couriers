import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import {
  HANDOFF_RULES,
  MANIFEST_TYPES,
  authenticateApiKey,
  cancelDelivery,
  createDelivery,
  listDeliveries,
  listLocations,
  str,
  type ApiAuth,
  type ApiResult,
} from '@/lib/public-api'

export const dynamic = 'force-dynamic'

// Stateless MCP server over Streamable HTTP (JSON responses, no sessions).
const SUPPORTED_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05']
const limiter = rateLimit({ max: 120, windowMs: 60_000 })

const DELIVERY_STATUSES = 'posted, claimed, picked_up, en_route, delivered, flagged, failed_retry, failed_permanent, cancelled'

const TOOLS = [
  {
    name: 'list_pickup_locations',
    title: 'List pickup locations',
    description: 'List this business’s pickup locations. Use the id as location_id when creating a delivery from a non-default location.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'list_deliveries',
    title: 'List deliveries',
    description: `List this business’s most recent delivery orders, newest first. Optionally filter by status (${DELIVERY_STATUSES}).`,
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by order status' },
        limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'get_delivery',
    title: 'Get delivery status',
    description: 'Look up one delivery by its id or tracking code and return its status, timestamps, ETA and proof of delivery.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Delivery UUID' },
        tracking_code: { type: 'string', description: 'Tracking code shown to the customer' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: 'create_delivery',
    title: 'Create delivery',
    description:
      'Book a new delivery from one of this business’s pickup locations. Confirm the address and recipient with the user before calling. Always pass an idempotency_key (e.g. the user’s order number) so a retry never creates a duplicate.',
    inputSchema: {
      type: 'object',
      properties: {
        dropoff_address: { type: 'string', description: 'Full street address for drop-off' },
        dropoff_area: { type: 'string', description: 'Neighbourhood or city area, e.g. "Downtown"' },
        idempotency_key: { type: 'string', description: 'Unique key for this order; reusing it returns the original order' },
        recipient_name: { type: 'string' },
        recipient_phone: { type: 'string', description: 'E.164 format, e.g. +14165550100' },
        recipient_note: { type: 'string', description: 'Instructions for the courier' },
        buzz_code: { type: 'string' },
        dropoff_postal_code: { type: 'string' },
        location_id: { type: 'string', description: 'Pickup location id; defaults to the default location' },
        is_rush: { type: 'boolean' },
        require_signature: { type: 'boolean' },
        require_pin: { type: 'boolean' },
        handoff_rule: { type: 'string', enum: [...HANDOFF_RULES], default: 'door' },
        handoff_require_id: { type: 'boolean', description: 'Courier checks photo ID. Not allowed with handoff_rule "door".' },
        handoff_named_person: { type: 'string', description: 'Required when handoff_rule is "recipient_or_named"' },
        handoff_named_relationship: { type: 'string' },
        handoff_location_note: { type: 'string' },
        items: {
          type: 'array',
          maxItems: 50,
          items: {
            type: 'object',
            properties: {
              type: { type: 'string', enum: [...MANIFEST_TYPES] },
              quantity: { type: 'integer', minimum: 1, maximum: 999 },
              notes: { type: 'string' },
            },
            required: ['type'],
          },
        },
      },
      required: ['dropoff_address', 'dropoff_area', 'idempotency_key'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
  },
  {
    name: 'cancel_delivery',
    title: 'Cancel delivery',
    description:
      'Cancel a delivery that no courier has taken yet. A cancellation fee from the rate card may apply and is returned. Once a courier has claimed it, the user must contact dispatch. Confirm with the user first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Delivery UUID' },
        reason: { type: 'string' },
      },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
  },
] as const

type Json = Record<string, unknown>

function toolResult<T>(r: ApiResult<T>) {
  if (!r.ok) {
    return { isError: true, content: [{ type: 'text', text: `Error (${r.code ?? r.status}): ${r.message}` }] }
  }
  const payload = r.replay ? { data: r.data, note: 'Existing order returned for this idempotency_key; no new order was created.' } : { data: r.data }
  return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }], structuredContent: payload }
}

async function callTool(auth: ApiAuth, name: string, args: Json) {
  switch (name) {
    case 'list_pickup_locations':
      return toolResult(await listLocations(auth))
    case 'list_deliveries':
      return toolResult(await listDeliveries(auth, { status: str(args.status, 40), limit: Number(args.limit) || null }))
    case 'get_delivery': {
      const id = str(args.id, 40)
      const tracking = str(args.tracking_code, 40)
      if (!id && !tracking) return toolResult({ ok: false, message: 'Pass id or tracking_code', status: 400, code: 'missing_fields' })
      const r = await listDeliveries(auth, { id, tracking_code: tracking, limit: 1 })
      if (r.ok && r.data.length === 0) return toolResult({ ok: false, message: 'Order not found', status: 404, code: 'not_found' })
      return toolResult(r.ok ? { ...r, data: r.data[0] } : r)
    }
    case 'create_delivery': {
      const { idempotency_key, ...body } = args
      return toolResult(await createDelivery(auth, body, str(idempotency_key, 100)))
    }
    case 'cancel_delivery':
      return toolResult(await cancelDelivery(auth, String(args.id ?? ''), str(args.reason, 500)))
    default:
      return null
  }
}

const rpcResult = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })
const rpcError = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } })

async function handleMessage(auth: ApiAuth, msg: Json) {
  const id = msg.id
  const isNotification = id === undefined
  if (msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') return isNotification ? null : rpcError(id, -32600, 'Invalid request')
  const params = (msg.params ?? {}) as Json

  switch (msg.method) {
    case 'initialize': {
      const requested = String(params.protocolVersion ?? '')
      return rpcResult(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'doms-deliveries', title: 'DOMS Deliveries', version: '1.0.0' },
        instructions:
          'Tools for one DOMS courier business account. Always confirm addresses and recipient details with the user before create_delivery or cancel_delivery, and pass a stable idempotency_key when creating.',
      })
    }
    case 'ping':
      return rpcResult(id, {})
    case 'tools/list':
      return rpcResult(id, { tools: TOOLS })
    case 'tools/call': {
      const name = String(params.name ?? '')
      const args = params.arguments && typeof params.arguments === 'object' && !Array.isArray(params.arguments) ? (params.arguments as Json) : {}
      const result = await callTool(auth, name, args)
      return result ? rpcResult(id, result) : rpcError(id, -32602, `Unknown tool: ${name}`)
    }
    default:
      if (isNotification) return null
      return rpcError(id, -32601, `Method not found: ${msg.method}`)
  }
}

function unauthorized() {
  return NextResponse.json(rpcError(null, -32001, 'Invalid or missing API key. Send Authorization: Bearer doms_live_…'), {
    status: 401,
    headers: { 'WWW-Authenticate': 'Bearer realm="doms"' },
  })
}

export async function POST(req: NextRequest) {
  const auth = await authenticateApiKey(req.headers.get('authorization'))
  if (!auth) return unauthorized()
  if (!limiter.check(auth.id).ok) return NextResponse.json(rpcError(null, -32000, 'Rate limit exceeded'), { status: 429 })

  const body = (await req.json().catch(() => undefined)) as unknown
  if (body === undefined) return NextResponse.json(rpcError(null, -32700, 'Parse error'), { status: 400 })

  const messages = Array.isArray(body) ? body : [body]
  if (messages.length === 0 || messages.length > 20) return NextResponse.json(rpcError(null, -32600, 'Invalid request'), { status: 400 })

  const responses = []
  for (const m of messages) {
    const r = m && typeof m === 'object' ? await handleMessage(auth, m as Json) : rpcError(null, -32600, 'Invalid request')
    if (r) responses.push(r)
  }
  if (responses.length === 0) return new NextResponse(null, { status: 202 })
  return NextResponse.json(Array.isArray(body) ? responses : responses[0])
}

// No server-initiated stream; clients fall back to plain request/response.
export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}

export function DELETE() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } })
}
