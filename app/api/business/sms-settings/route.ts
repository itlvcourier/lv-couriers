import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdminOrBusinessOwner, isAuthError } from '@/lib/auth-guard'
import { SMS_SIGNATURE_MAP, validateSmsSignature } from '@/lib/sms-templates'
import { invalidateSmsTemplateCache } from '@/lib/sms-templates-server'

export const dynamic = 'force-dynamic'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export async function GET(request: NextRequest) {
  const businessId = request.nextUrl.searchParams.get('businessId')
  const auth = await requireAdminOrBusinessOwner(request, businessId)
  if (isAuthError(auth)) return auth

  const admin = createAdminClient()
  const [{ data: biz, error }, { data: defaultSig }, { data: locations }] = await Promise.all([
    admin.from('businesses').select('email, website, google_review_link, sms_signature, sms_note').eq('id', businessId!).maybeSingle(),
    admin.from('sms_templates').select('body').eq('key', 'signature.recipient').maybeSingle<{ body: string | null }>(),
    admin.from('business_locations').select('id, name, address, sms_signature, sms_note, google_review_link').eq('business_id', businessId!),
  ])
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!biz) return NextResponse.json({ error: 'Business not found' }, { status: 404 })

  return NextResponse.json({
    settings: biz,
    defaultSignature: defaultSig?.body ?? SMS_SIGNATURE_MAP['signature.recipient'].defaultBody,
    locations: locations ?? [],
  })
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json().catch(() => ({}))) as {
    businessId?: string
    email?: string
    website?: string
    smsSignature?: string
    smsNote?: string
    googleReviewLink?: string
    locationId?: string
  }
  const auth = await requireAdminOrBusinessOwner(request, payload.businessId)
  if (isAuthError(auth)) return auth

  const email = payload.email?.trim() ?? ''
  const website = payload.website?.trim() ?? ''
  const smsSignature = payload.smsSignature?.trim() ?? ''
  const smsNote = payload.smsNote?.trim() ?? ''
  const googleReviewLink = payload.googleReviewLink?.trim() ?? ''

  if (!email) return NextResponse.json({ error: 'Contact email is required' }, { status: 400 })
  if (!EMAIL.test(email)) return NextResponse.json({ error: 'Enter a valid email address' }, { status: 400 })
  if (website.length > 120) return NextResponse.json({ error: 'Website is too long' }, { status: 400 })
  if (googleReviewLink && !/^https:\/\/(www\.)?(google\.[^/]+|g\.page)\//i.test(googleReviewLink)) {
    return NextResponse.json({ error: 'Use a valid Google review link' }, { status: 400 })
  }
  if (googleReviewLink.length > 300) return NextResponse.json({ error: 'Google review link is too long' }, { status: 400 })
  if (smsNote.length > 160) return NextResponse.json({ error: 'Note must be 160 characters or fewer' }, { status: 400 })
  if (/\{[a-z_]+\}/.test(smsNote)) return NextResponse.json({ error: 'The note cannot contain tags' }, { status: 400 })
  const sigError = validateSmsSignature(smsSignature)
  if (sigError) return NextResponse.json({ error: sigError }, { status: 400 })

  const admin = createAdminClient()
  if (payload.locationId) {
    const { data: location } = await admin.from('business_locations').select('id').eq('id', payload.locationId).eq('business_id', payload.businessId!).maybeSingle()
    if (!location) return NextResponse.json({ error: 'Location not found for this business' }, { status: 404 })
    const { error } = await admin.from('business_locations').update({ sms_signature: smsSignature || null, sms_note: smsNote || null, google_review_link: googleReviewLink || null }).eq('id', payload.locationId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    invalidateSmsTemplateCache()
    return NextResponse.json({ ok: true })
  }

  const { error } = await admin
    .from('businesses')
    .update({
      ...(email ? { email } : {}),
      website: website || null,
      google_review_link: googleReviewLink || null,
      sms_signature: smsSignature || null,
      sms_note: smsNote || null,
    })
    .eq('id', payload.businessId!)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  invalidateSmsTemplateCache()
  return NextResponse.json({ ok: true })
}
