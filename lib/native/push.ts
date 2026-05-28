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
