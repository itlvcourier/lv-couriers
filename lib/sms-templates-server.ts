import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SMS_TEMPLATE_MAP, renderSmsTemplate, type SmsTemplateKey } from '@/lib/sms-templates'

const CACHE_TTL_MS = 30_000
let cache: { at: number; overrides: Map<string, string> } | null = null

async function loadOverrides(): Promise<Map<string, string>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.overrides
  try {
    const { data, error } = await createAdminClient().from('sms_templates').select('key, body')
    if (error) throw error
    const overrides = new Map((data ?? []).map((r: { key: string; body: string }) => [r.key, r.body]))
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
}

/** Raw (unrendered) body, for loops that render many messages from one template. */
export async function getSmsTemplateBody(key: SmsTemplateKey): Promise<string> {
  const overrides = await loadOverrides()
  return overrides.get(key) ?? SMS_TEMPLATE_MAP[key].defaultBody
}

/** Render the admin-customized (or default) text for an SMS template. */
export async function renderSms(
  key: SmsTemplateKey,
  vars: Record<string, string | number | null | undefined>,
): Promise<string> {
  const def = SMS_TEMPLATE_MAP[key]
  const overrides = await loadOverrides()
  const body = overrides.get(key) ?? def.defaultBody
  return renderSmsTemplate(body, vars).trim()
}
