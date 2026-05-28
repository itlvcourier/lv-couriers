import { isNativeApp, isIOS } from './index'

/**
 * Share & maps bridge.
 *
 * - shareContent(): native share sheet in the app; Web Share API or clipboard
 *   fallback on the web.
 * - openMaps(): opens native Google/Apple Maps for navigation.
 */

export interface ShareOptions {
  title?: string
  text?: string
  url?: string
  dialogTitle?: string
}

export async function shareContent(options: ShareOptions): Promise<boolean> {
  if (isNativeApp()) {
    try {
      const { Share } = await import('@capacitor/share')
      await Share.share({
        title: options.title,
        text: options.text,
        url: options.url,
        dialogTitle: options.dialogTitle,
      })
      return true
    } catch {
      return false
    }
  }

  // Web fallback: Web Share API where available, else copy URL to clipboard.
  try {
    if (typeof navigator !== 'undefined' && navigator.share) {
      await navigator.share({ title: options.title, text: options.text, url: options.url })
      return true
    }
    if (options.url && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(options.url)
      return true
    }
  } catch {
    // user cancelled or unsupported
  }
  return false
}

/**
 * Open native maps with directions to a destination.
 * Uses Apple Maps on iOS, Google Maps elsewhere.
 */
export async function openMaps(opts: {
  lat?: number
  lng?: number
  address?: string
  label?: string
}): Promise<void> {
  const query = opts.address
    ? encodeURIComponent(opts.address)
    : opts.lat != null && opts.lng != null
      ? `${opts.lat},${opts.lng}`
      : ''
  if (!query) return

  const url = isIOS()
    ? `https://maps.apple.com/?daddr=${query}`
    : `https://www.google.com/maps/dir/?api=1&destination=${query}`

  if (isNativeApp()) {
    try {
      const { Browser } = await import('@capacitor/browser')
      // Opening a maps URL hands off to the installed maps app on device.
      await Browser.open({ url })
      return
    } catch {
      // fall through to web behavior
    }
  }

  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
