import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  WEBHOOK_EVENTS, generateApiKey, generateWebhookSecret, isAllowedWebhookUrl, sendTestWebhook,
} from '@/lib/webhooks'

async function businessAuth(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth
  if (auth.profile.role !== 'business' || !auth.profile.business_id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return auth
}

export async function GET(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const db = createAdminClient()
  const bid = auth.profile.business_id!
  const [keys, hooks] = await Promise.all([
    db.from('api_keys').select('id, name, key_prefix, last_used_at, revoked_at, created_at').eq('business_id', bid).order('created_at', { ascending: false }),
    db.from('webhook_endpoints').select('id, url, events, active, created_at').eq('business_id', bid).order('created_at', { ascending: false }),
  ])
  const hookIds = (hooks.data ?? []).map((h) => h.id)
  const { data: recent } = hookIds.length
    ? await db.from('webhook_deliveries').select('id, endpoint_id, event, status_code, error, created_at').in('endpoint_id', hookIds).order('created_at', { ascending: false }).limit(25)
    : { data: [] }
  return NextResponse.json({ keys: keys.data ?? [], webhooks: hooks.data ?? [], recentDeliveries: recent ?? [], events: WEBHOOK_EVENTS })
}

/** Actions: create_key, revoke_key, create_webhook, delete_webhook, toggle_webhook, test_webhook */
export async function POST(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const bid = auth.profile.business_id!
  const db = createAdminClient()
  const body = (await req.json().catch(() => null)) as {
    action?: string; id?: string; name?: string; url?: string; events?: string[]; active?: boolean
  } | null
  switch (body?.action) {
    case 'create_key': {
      const { count } = await db.from('api_keys').select('id', { count: 'exact', head: true }).eq('business_id', bid).is('revoked_at', null)
      if ((count ?? 0) >= 5) return NextResponse.json({ error: 'Revoke an existing key first (max 5 active).' }, { status: 400 })
      const k = generateApiKey()
      const { error } = await db.from('api_keys').insert({
        business_id: bid, name: (body.name || 'API key').slice(0, 80), key_prefix: k.prefix, key_hash: k.hash, created_by: auth.user.id,
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ key: k.raw })
    }
    case 'revoke_key': {
      if (!body.id) break
      await db.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', body.id).eq('business_id', bid)
      return NextResponse.json({ ok: true })
    }
    case 'create_webhook': {
      if (!body.url || !isAllowedWebhookUrl(body.url)) {
        return NextResponse.json({ error: 'Use a public https:// URL' }, { status: 400 })
      }
      const events = (body.events ?? []).filter((e) => (WEBHOOK_EVENTS as readonly string[]).includes(e))
      const secret = generateWebhookSecret()
      const { error } = await db.from('webhook_endpoints').insert({ business_id: bid, url: body.url.slice(0, 500), secret, events })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ secret })
    }
    case 'delete_webhook': {
      if (!body.id) break
      await db.from('webhook_endpoints').delete().eq('id', body.id).eq('business_id', bid)
      return NextResponse.json({ ok: true })
    }
    case 'toggle_webhook': {
      if (!body.id || typeof body.active !== 'boolean') break
      await db.from('webhook_endpoints').update({ active: body.active }).eq('id', body.id).eq('business_id', bid)
      return NextResponse.json({ ok: true })
    }
    case 'test_webhook': {
      if (!body.id) break
      const { data: ep } = await db.from('webhook_endpoints').select('id, url, secret').eq('id', body.id).eq('business_id', bid).maybeSingle()
      if (!ep) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const r = await sendTestWebhook(ep)
      return NextResponse.json(r)
    }
  }
  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
