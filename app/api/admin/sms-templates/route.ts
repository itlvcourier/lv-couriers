import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'
import { SMS_TEMPLATE_MAP, validateSmsTemplate } from '@/lib/sms-templates'
import { invalidateSmsTemplateCache } from '@/lib/sms-templates-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const { data, error } = await createAdminClient()
    .from('sms_templates')
    .select('key, body, updated_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data ?? [] })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const { key, body } = (await request.json().catch(() => ({}))) as { key?: string; body?: string }
  const def = key ? SMS_TEMPLATE_MAP[key] : undefined
  if (!def || typeof body !== 'string') {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  const validationError = validateSmsTemplate(def, body)
  if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })

  const admin = createAdminClient()
  // Saving the default text verbatim is the same as resetting it.
  const { error } =
    body === def.defaultBody
      ? await admin.from('sms_templates').delete().eq('key', def.key)
      : await admin.from('sms_templates').upsert({
          key: def.key,
          body,
          updated_at: new Date().toISOString(),
          updated_by: auth.user.id,
        })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSmsTemplateCache()
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const key = request.nextUrl.searchParams.get('key')
  if (!key || !SMS_TEMPLATE_MAP[key]) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  const { error } = await createAdminClient().from('sms_templates').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSmsTemplateCache()
  return NextResponse.json({ ok: true })
}
