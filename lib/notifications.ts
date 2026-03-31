'use client'

export interface NotificationOptions {
  title: string
  body?: string
  icon?: string
  badge?: string
  tag?: string
  requireInteraction?: boolean
  actions?: Array<{ action: string; title: string }>
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('[v0] Notifications not supported')
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission()
    return permission
  }

  return 'denied'
}

export function showNotification(options: NotificationOptions): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    console.warn('[v0] Cannot show notification - permission denied')
    return
  }

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon || '/icon.svg',
      badge: options.badge,
      tag: options.tag,
      requireInteraction: options.requireInteraction || false,
    })

    if (options.actions) {
      // Note: ServiceWorker needed for action handling
      notification.actions = options.actions as NotificationAction[]
    }

    notification.onclick = () => {
      window.focus()
      notification.close()
    }
  } catch (err) {
    console.error('[v0] Error showing notification:', err)
  }
}

export function showSuccessNotification(message: string): void {
  showNotification({
    title: 'Success',
    body: message,
    icon: '/icon.svg',
  })
}

export function showErrorNotification(message: string): void {
  showNotification({
    title: 'Error',
    body: message,
    icon: '/icon.svg',
    requireInteraction: true,
  })
}

export function showJobNotification(jobTitle: string, details: string): void {
  showNotification({
    title: 'New Job',
    body: `${jobTitle} - ${details}`,
    icon: '/icon.svg',
    tag: 'new-job',
  })
}

export function showDeliveryStatusNotification(status: string, address: string): void {
  const statusMessages: Record<string, string> = {
    claimed: '✓ Job claimed',
    picked_up: '✓ Package picked up',
    in_transit: '🚗 En route',
    delivered: '✓ Delivered',
    failed: '✗ Delivery failed',
  }

  showNotification({
    title: statusMessages[status] || 'Delivery Update',
    body: address,
    icon: '/icon.svg',
    tag: 'delivery-status',
  })
}
