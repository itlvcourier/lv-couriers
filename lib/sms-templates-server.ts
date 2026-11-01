import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  SMS_SIGNATURE_MAP,
  SMS_TEMPLATE_MAP,
  composeSms,
  signatureKeyFor,
  usesSignatureByDefault,
  type SmsTemplateKey,
} from '@/lib/sms-templates'

type Vars = Record<string, string | number | null | undefined>
type Override = { body: string | null; use_signature: boolean | null }

const CACHE_TTL_MS = 30_000
let cache: { at: number; overrides: Map<string, Override> } | null = null

async function loadOverrides(): Promise<Map<string, Override>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.overrides
  try {
    const { data, error } = await createAdminClient().from('sms_templates').select('key, body, use_signature')
    if (error) throw error
    const overrides = new Map(
      (data ?? []).map((r: { key: string } & Override) => [r.key, { body: r.body, use_signature: r.use_signature }]),
    )
    cache = { at: Date.now(), overrides }
    return overrides
  } catch (err) {
    // Never block a send on template lookup: fall back to defaults.
    console.error('sms_templates load failed, using defaults:', err)
    return cache?.overrides ?? new Map()
  }
}

export function invalidateSmsTemplateCache() {
  cache = null
  businessCache.clear()
}

type BusinessContext = { tags: Vars; customerSignature: string | null }
const businessCache = new Map<string, { at: number; value: BusinessContext }>()

async function loadBusinessContext(ctx: SmsContext): Promise<BusinessContext | null> {
  const cacheKey = ctx.deliveryId ? `d:${ctx.deliveryId}` : ctx.businessId ? `b:${ctx.businessId}` : null
  if (!cacheKey) return null
  const hit = businessCache.get(cacheKey)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value

  try {
    const admin = createAdminClient()
    let businessId = ctx.businessId ?? null
    let locationId = ctx.locationId ?? null
    if (ctx.deliveryId && (!businessId || !locationId)) {
      const { data: d } = await admin
        .from('deliveries')
        .select('business_id, location_id')
        .eq('id', ctx.deliveryId)
        .maybeSingle<{ business_id: string | null; location_id: string | null }>()
      businessId = businessId ?? d?.business_id ?? null
      locationId = locationId ?? d?.location_id ?? null
    }
    if (!businessId) return null

    const [{ data: biz }, { data: loc }] = await Promise.all([
      admin
        .from('businesses')
        .select('name, phone, contact_phone, email, website, sms_signature, sms_note')
        .eq('id', businessId)
        .maybeSingle<{
          name: string | null
          phone: string | null
          contact_phone: string | null
          email: string | null
          website: string | null
          sms_signature: string | null
          sms_note: string | null
        }>(),
      locationId
        ? admin
            .from('business_locations')
            .select('name, phone, contact_phone, address')
            .eq('id', locationId)
            .maybeSingle<{ name: string | null; phone: string | null; contact_phone: string | null; address: string | null }>()
        : Promise.resolve({ data: null }),
    ])
    if (!biz) return null

    const value: BusinessContext = {
      tags: {
        business_name: biz.name,
        business_phone: biz.phone || biz.contact_phone,
        business_email: biz.email,
        business_website: biz.website,
        business_note: biz.sms_note,
        location_name: loc?.name,
        location_phone: loc?.phone || loc?.contact_phone,
        location_address: loc?.address,
      },
      customerSignature: biz.sms_signature?.trim() || null,
    }
    businessCache.set(cacheKey, { at: Date.now(), value })
    return value
  } catch (err) {
    console.error('sms business context load failed:', err)
    return null
  }
}

/** Raw (unrendered) body, for loops that render many messages from one template. */
export async function getSmsTemplateBody(key: SmsTemplateKey): Promise<string> {
  const overrides = await loadOverrides()
  return overrides.get(key)?.body ?? SMS_TEMPLATE_MAP[key].defaultBody
}

export type SmsContext = {
  /** Looks up the delivery's business and branch for contact tags and signature. */
  deliveryId?: string | null
  businessId?: string | null
  locationId?: string | null
}

/**
 * Render an SMS: admin-customized (or default) text, business contact tags,
 * and the audience signature (business override for customer texts).
 */
export async function renderSms(key: SmsTemplateKey, vars: Vars, ctx: SmsContext = {}): Promise<string> {
  const def = SMS_TEMPLATE_MAP[key]
  const [overrides, business] = await Promise.all([loadOverrides(), loadBusinessContext(ctx)])
  const override = overrides.get(key)
  const body = override?.body ?? def.defaultBody

  let signature: string | null = null
  const sigKey = signatureKeyFor(def.audience)
  if (sigKey && (override?.use_signature ?? usesSignatureByDefault(def))) {
    const adminSignature = overrides.get(sigKey)?.body ?? SMS_SIGNATURE_MAP[sigKey].defaultBody
    signature = sigKey === 'signature.recipient' ? (business?.customerSignature ?? adminSignature) : adminSignature
  }

  // Explicit vars win (routes already pass business_name), blanks fall back to the lookup.
  const merged: Vars = { ...(business?.tags ?? {}) }
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined && v !== null && !(k in merged && String(v).trim() === '')) merged[k] = v
  }
  return composeSms(body, signature, merged)
}
