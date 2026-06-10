import { type NextRequest, NextResponse } from 'next/server'
import { validateAddress } from '@/lib/google-maps'

/**
 * POST /api/delivery/validate-address
 * Body: { address: string }
 * Returns a normalized AddressValidationResult (confidence, coords, issues).
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const address = typeof body?.address === 'string' ? body.address : ''
    if (!address || address.trim().length < 3) {
      return NextResponse.json({ error: 'address is required' }, { status: 400 })
    }
    const result = await validateAddress(address)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[v0] validate-address route error:', error)
    return NextResponse.json({ error: 'validation failed' }, { status: 500 })
  }
}
