import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin, isAuthError } from '@/lib/auth-guard'
import {
  SMS_SIGNATURE_MAP,
  SMS_TEMPLATE_MAP,
  usesSignatureByDefault,
  validateSmsSignature,
  validateSmsTemplate,
  type SmsSignatureKey,
} from '@/lib/sms-templates'
import { invalidateSmsTemplateCache } from '@/lib/sms-templates-server'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const { data, error } = await createAdminClient()
    .from('sms_templates')
    .select('key, body, use_signature, updated_at')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ overrides: data ?? [] })
}

export async function PUT(request: NextRequest) {
  const auth = await requireAdmin(request)
  if (isAuthError(auth)) return auth

  const { key, body, useSignature } = (await request.json().catch(() => ({}))) as {
    key?: string
    body?: string
    useSignature?: boolean
  }
  if (!key || typeof body !== 'string') {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  let storedBody: string | null
  let storedUseSignature: boolean | null = null

  const signatureDef = SMS_SIGNATURE_MAP[key as SmsSignatureKey]
  const templateDef = SMS_TEMPLATE_MAP[key]
  if (signatureDef) {
    const trimmed = body.trim()
    const validationError = validateSmsSignature(trimmed)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    storedBody = trimmed === signatureDef.defaultBody ? null : trimmed
  } else if (templateDef) {
    const validationError = validateSmsTemplate(templateDef, body)
    if (validationError) return NextResponse.json({ error: validationError }, { status: 400 })
    storedBody = body === templateDef.defaultBody ? null : body
    if (typeof useSignature === 'boolean' && useSignature !== usesSignatureByDefault(templateDef)) {
      storedUseSignature = useSignature
    }
  } else {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  const admin = createAdminClient()
  // Matching every default is the same as resetting.
  const { error } =
    storedBody === null && storedUseSignature === null
      ? await admin.from('sms_templates').delete().eq('key', key)
      : await admin.from('sms_templates').upsert({
          key,
          body: storedBody,
          use_signature: storedUseSignature,
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
  if (!key || !(SMS_TEMPLATE_MAP[key] || SMS_SIGNATURE_MAP[key as SmsSignatureKey])) {
    return NextResponse.json({ error: 'Unknown template' }, { status: 400 })
  }

  const { error } = await createAdminClient().from('sms_templates').delete().eq('key', key)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSmsTemplateCache()
  return NextResponse.json({ ok: true })
}
