/**
 * rate-limit.ts
 *
 * Simple in-memory sliding-window rate limiter for API routes.
 * Resets on server restart (sufficient for serverless — each instance has its
 * own counter, but brute-force across restarts is deterred).
 *
 * Usage:
 *   const limiter = rateLimit({ max: 5, windowMs: 15 * 60 * 1000 })
 *   const { ok, retryAfter } = limiter.check(ip)
 *   if (!ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
 */

interface RateLimitOptions {
  /** Maximum requests allowed in the window */
  max: number
  /** Window size in milliseconds */
  windowMs: number
}

interface CheckResult {
  ok: boolean
  /** Seconds until the window resets (only set when ok=false) */
  retryAfter?: number
}

export function rateLimit({ max, windowMs }: RateLimitOptions) {
  // Map<key, timestamps[]>
  const store = new Map<string, number[]>()

  function check(key: string): CheckResult {
    const now = Date.now()
    const windowStart = now - windowMs
    const hits = (store.get(key) ?? []).filter(t => t > windowStart)

    if (hits.length >= max) {
      const oldest = hits[0]
      const retryAfter = Math.ceil((oldest + windowMs - now) / 1000)
      return { ok: false, retryAfter }
    }

    hits.push(now)
    store.set(key, hits)
    return { ok: true }
  }

  return { check }
}

/** Extract a best-effort IP from a Next.js request */
export function getClientIp(req: import('next/server').NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  )
}
