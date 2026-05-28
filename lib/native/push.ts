import { isNativeApp, getPlatform } from './index'

/**
 * Push notifications bridge.
 *
 * `initPushNotifications()` requests permission, registers the device with
 * APNs/FCM, sends the resulting token to our backend (/api/push/register), and
 * wires up tap handling. Safe no-op on the web.
 */

export interface PushHandlers {
  /** Called when a notification arrives while the app is in the foreground. */
  onForeground?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
  /** Called when the user taps a notification. Use `data.url` for deep linking. */
  onTap?: (data: Record<string, unknown>) => void
}

let registered = false

async function sendTokenToBackend(token: string): Promise<void> {
  try {
    await fetch('/api/push/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, platform: getPlatform() }),
    })
  } catch (e) {
    console.error('[v0] push: failed to register token with backend', e)
  }
}

export async function initPushNotifications(handlers?: PushHandlers): Promise<void> {
  if (!isNativeApp() || registered) return
  registered = true

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')

    let permission = await PushNotifications.checkPermissions()
    if (permission.receive === 'prompt' || permission.receive === 'prompt-with-rationale') {
      permission = await PushNotifications.requestPermissions()
    }
    if (permission.receive !== 'granted') {
      console.log('[v0] push: permission not granted')
      registered = false
      return
    }

    // Fires with the device token after a successful registration.
    await PushNotifications.addListener('registration', (token) => {
      void sendTokenToBackend(token.value)
    })

    await PushNotifications.addListener('registrationError', (err) => {
      console.error('[v0] push: registration error', err)
    })

    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      handlers?.onForeground?.({
        title: notification.title,
        body: notification.body,
        data: notification.data as Record<string, unknown>,
      })
    })

    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      handlers?.onTap?.(action.notification.data as Record<string, unknown>)
    })

    await PushNotifications.register()
  } catch (e) {
    console.error('[v0] push: init failed', e)
    registered = false
  }
}

/**
 * Unregisters this device's push token from the backend (call on logout so a
 * signed-out device stops receiving the previous user's notifications).
 * Safe no-op on the web.
 */
export async function unregisterDevicePush(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    // Capture the current token, then tell the backend to drop it.
    const tokenPromise = new Promise<string | null>((resolve) => {
      let settled = false
      PushNotifications.addListener('registration', (t) => {
        if (!settled) {
          settled = true
          resolve(t.value)
        }
      }).catch(() => resolve(null))
      // Fail open after a short wait so logout is never blocked.
      setTimeout(() => {
        if (!settled) {
          settled = true
          resolve(null)
        }
      }, 1500)
    })
    await PushNotifications.register()
    const token = await tokenPromise
    if (token) {
      await fetch('/api/push/register', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })
    }
    await PushNotifications.removeAllListeners()
    registered = false
  } catch (e) {
    console.error('[v0] push: unregister failed', e)
  }
}

/** Clears the app's notification badge / delivered notifications. */
export async function clearDeliveredNotifications(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    await PushNotifications.removeAllDeliveredNotifications()
  } catch {
    // ignore
  }
}
