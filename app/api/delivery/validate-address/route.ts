import { type NextRequest, NextResponse } from 'next/server'
import { validateAddress } from '@/lib/google-maps'
import { requireAuth, isAuthError } from '@/lib/auth-guard'

/**
 * POST /api/delivery/validate-address
 * Body: { address: string }
 * Returns a normalized AddressValidationResult (confidence, coords, issues).
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req)
  if (isAuthError(auth)) return auth

  try {
    const body = await req.json()
    const address = typeof body?.address === 'string' ? body.address : ''
    if (!address || address.trim().length < 3) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }
    const result = await validateAddress(address)
    return NextResponse.json(result)
  } catch (error) {
    console.error('validate-address error:', error instanceof Error ? error.message : error)
    return NextResponse.json({ error: 'validation failed' }, { status: 500 })
  }
}
