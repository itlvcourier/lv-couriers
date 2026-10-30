'use client'

import { createClient } from '@/lib/supabase/client'

/** fetch() for our API routes that carries the Supabase access token (cookies can be dropped in webviews). */
export async function authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  try {
    const { data } = await createClient().auth.getSession()
    const token = data.session?.access_token
    if (token) headers.set('Authorization', `Bearer ${token}`)
  } catch {
    // Fall back to cookie auth
  }
  return fetch(url, { ...init, headers, credentials: 'same-origin' })
}

/** JSON helper: throws with the server's error message on non-2xx. */
export async function authedJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  const res = await authedFetch(url, { ...init, headers })
  const data = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`)
  return data
}

/** Best-effort current position; resolves null if unavailable within 5s. */
export function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise(resolve => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60_000 },
    )
  })
}
