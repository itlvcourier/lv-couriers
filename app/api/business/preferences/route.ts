import { NextRequest, NextResponse } from 'next/server'
import { requireAuth, isAuthError } from '@/lib/auth-guard'
import { createAdminClient } from '@/lib/supabase/admin'

export interface AlertPrefs {
  email_failed?: boolean
  email_consent?: boolean
  email_late?: boolean
  email_issue_updates?: boolean
  alert_email?: string | null
}

const BOOL_KEYS = ['email_failed', 'email_consent', 'email_late', 'email_issue_updates'] as const

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
  const { data } = await createAdminClient()
    .from('businesses')
    .select('alert_prefs, brand_color, brand_logo_url, tracking_message')
    .eq('id', auth.profile.business_id!)
    .maybeSingle()
  return NextResponse.json({
    alertPrefs: (data?.alert_prefs ?? {}) as AlertPrefs,
    branding: {
      brandColor: data?.brand_color ?? null,
      brandLogoUrl: data?.brand_logo_url ?? null,
      trackingMessage: data?.tracking_message ?? null,
    },
  })
}

export async function PATCH(req: NextRequest) {
  const auth = await businessAuth(req)
  if (isAuthError(auth)) return auth
  const body = (await req.json().catch(() => null)) as {
    alertPrefs?: AlertPrefs
    branding?: { brandColor?: string | null; brandLogoUrl?: string | null; trackingMessage?: string | null }
  } | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const update: Record<string, unknown> = {}
  if (body.alertPrefs) {
    const p: AlertPrefs = {}
    for (const k of BOOL_KEYS) if (typeof body.alertPrefs[k] === 'boolean') p[k] = body.alertPrefs[k]
    const email = body.alertPrefs.alert_email?.trim()
    p.alert_email = email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 200) : null
    update.alert_prefs = p
  }
  if (body.branding) {
    const c = body.branding.brandColor?.trim()
    if (c && !/^#[0-9a-fA-F]{6}$/.test(c)) return NextResponse.json({ error: 'Brand color must be a hex value like #1a2b3c' }, { status: 400 })
    const logo = body.branding.brandLogoUrl?.trim()
    if (logo && !logo.startsWith('https://')) return NextResponse.json({ error: 'Logo must be an https URL' }, { status: 400 })
    update.brand_color = c || null
    update.brand_logo_url = logo || null
    update.tracking_message = body.branding.trackingMessage?.trim().slice(0, 280) || null
  }
  if (!Object.keys(update).length) return NextResponse.json({ ok: true })
  const { error } = await createAdminClient().from('businesses').update(update).eq('id', auth.profile.business_id!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
