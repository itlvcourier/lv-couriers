import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email'
import { driverWelcomeEmail } from '@/lib/email-templates'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * Create a new driver end-to-end:
 *  1. Create a Supabase auth user (bypasses email confirmation) with a temp
 *     password and user_metadata so the existing profile-trigger wires up the
 *     profile row correctly.
 *  2. Insert a drivers row using the same UUID as auth.users.id so
 *     profiles.driver_id can be backfilled to that id.
 *  3. Update the auto-created profile's driver_id so RLS + app look-ups work.
 *  4. Send a welcome email with the temp password via Resend.
 *
 * Idempotent-ish: if the auth user already exists we return 409. Admins should
 * use "resend invite" for that case (not implemented here).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    name?: string
    email?: string
    phone?: string
  }
  const name = body.name?.trim()
  const email = body.email?.trim().toLowerCase()
  const phone = body.phone?.trim() || ''

  if (!name || !email) {
    return NextResponse.json(
      { error: 'Missing required fields: name, email' },
      { status: 400 },
    )
  }

  const supabase = createAdminClient()

  // Generate a memorable temp password: letters + digits, length 12.
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const tempPassword = Array.from(
    { length: 12 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join('')

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: {
      full_name: name,
      role: 'driver',
      // driver_id intentionally blank — we'll set it in step 3 once we have
      // the drivers-row id (which is the same as auth.users.id).
      driver_id: '',
      business_id: '',
      location_id: '',
    },
  })

  if (authError || !authData?.user) {
    const status = /already registered|already exists|duplicate/i.test(authError?.message || '')
      ? 409
      : 400
    return NextResponse.json(
      { error: authError?.message || 'Failed to create auth user' },
      { status },
    )
  }

  const authId = authData.user.id

  // 2. Insert drivers row with the same UUID.
  const { error: driverError } = await supabase.from('drivers').insert({
    id: authId,
    name,
    email,
    phone,
    status: 'available',
    invite_status: 'pending',
    total_deliveries: 0,
    today_deliveries: 0,
    month_deliveries: 0,
  })

  if (driverError) {
    // Roll back the auth user so this route is safely retryable.
    await supabase.auth.admin.deleteUser(authId).catch(() => {})
    return NextResponse.json(
      { error: `Driver row create failed: ${driverError.message}` },
      { status: 500 },
    )
  }

  // 3. Update the auto-created profile so driver_id points at the new row.
  //    (The handle_new_user trigger inserted profile with driver_id = NULL
  //    because user_metadata.driver_id was empty.)
  await supabase
    .from('profiles')
    .update({ driver_id: authId })
    .eq('id', authId)

  // 4. Build the login URL using the site the request came from.
  const origin =
    req.headers.get('origin') ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${req.headers.get('host')}`
  const loginUrl = `${origin.replace(/\/$/, '')}/login`

  const tpl = driverWelcomeEmail({ name, email, tempPassword, loginUrl })
  const result = await sendEmail({
    to: email,
    subject: tpl.subject,
    html: tpl.html,
    text: tpl.text,
    tag: 'driver.welcome',
  })

  return NextResponse.json({
    ok: true,
    driverId: authId,
    email,
    emailSent: result.ok,
    emailError: result.ok ? undefined : result.reason,
    // Temp password returned so admin can share it out-of-band if email fails.
    // It's NOT logged anywhere server-side.
    tempPassword,
  })
}
