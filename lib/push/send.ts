import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Server-side push sender.
 *
 * Uses Firebase Cloud Messaging (FCM) HTTP v1 for BOTH Android and iOS.
 * On iOS, Capacitor's push-notifications plugin registers the device with
 * APNs and Firebase relays through APNs, so a single FCM call covers both
 * platforms once you have configured the iOS app in Firebase.
 *
 * Required environment variables (set these in your Vercel project):
 *   FIREBASE_PROJECT_ID            - your Firebase project id
 *   FIREBASE_CLIENT_EMAIL          - service account client email
 *   FIREBASE_PRIVATE_KEY           - service account private key (with \n escaped)
 *
 * If these are not set, sending is skipped gracefully (no crash) so the rest
 * of the notification flow keeps working.
 */

interface PushPayload {
  title: string
  body: string
  data?: Record<string, string>
}

let cachedToken: { token: string; expiresAt: number } | null = null

// Exchanges the service account credentials for a short-lived OAuth token.
async function getAccessToken(): Promise<string | null> {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY
  if (!clientEmail || !privateKeyRaw) {
    console.warn('[v0] push: FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY not set — skipping push')
    return null
  }

  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n')
  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  }

  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')
  const unsigned = `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(claim)}`

  const { createSign } = await import('node:crypto')
  const signer = createSign('RSA-SHA256')
  signer.update(unsigned)
  const signature = signer.sign(privateKey, 'base64url')
  const jwt = `${unsigned}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })

  if (!res.ok) {
    console.error('[v0] push: failed to get FCM access token', await res.text())
    return null
  }

  const json = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  }
  return json.access_token
}

// Sends a push notification to every registered device for the given user(s).
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<{ sent: number; failed: number }> {
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    console.warn('[v0] push: FIREBASE_PROJECT_ID not set — skipping push')
    return { sent: 0, failed: 0 }
  }
  if (userIds.length === 0) return { sent: 0, failed: 0 }

  const accessToken = await getAccessToken()
  if (!accessToken) return { sent: 0, failed: 0 }

  // Look up device tokens with the service-role client (bypasses RLS server-side).
  const admin = createAdminClient()
  const { data: tokens, error } = await admin
    .from('device_tokens')
    .select('token')
    .in('user_id', userIds)

  if (error) {
    console.error('[v0] push: failed to load device tokens', error.message)
    return { sent: 0, failed: 0 }
  }
  if (!tokens || tokens.length === 0) return { sent: 0, failed: 0 }

  const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`
  let sent = 0
  let failed = 0

  await Promise.all(
    tokens.map(async (row: { token: string }) => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: row.token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
            },
          }),
        })
        if (res.ok) {
          sent++
        } else {
          failed++
          // 404/400 means the token is stale — remove it.
          if (res.status === 404 || res.status === 400) {
            await admin.from('device_tokens').delete().eq('token', row.token)
          }
        }
      } catch (err) {
        failed++
        console.error('[v0] push: send error', err)
      }
    })
  )

  return { sent, failed }
}
