import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  if (!token || token.length > 120) return NextResponse.json({ error: 'Invalid link' }, { status: 400 })

  const admin = createAdminClient()
  const { data: feedback } = await admin
    .from('customer_feedback')
    .select('business_id, token_expires_at, feedback_received')
    .eq('token', token)
    .gt('token_expires_at', new Date().toISOString())
    .eq('feedback_received', false)
    .maybeSingle<{ business_id: string; token_expires_at: string; feedback_received: boolean }>()

  if (!feedback) return NextResponse.json({ error: 'Feedback link not found or expired' }, { status: 404 })

  const { data: business } = await admin
    .from('businesses')
    .select('name, google_review_link')
    .eq('id', feedback.business_id)
    .maybeSingle<{ name: string | null; google_review_link: string | null }>()

  return NextResponse.json({ businessName: business?.name ?? null, googleReviewLink: business?.google_review_link ?? null })
}
