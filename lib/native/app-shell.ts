import { isNativeApp } from './index'

/**
 * App-shell bridge: splash screen, status bar theming, Android hardware back
 * button, and haptic feedback. All functions are safe no-ops on the web.
 */

/** Hide the native splash screen once the web app has rendered. */
export async function hideSplash(): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch {
    // ignore
  }
}

/** Apply status bar styling that matches the app theme. */
export async function applyStatusBarTheme(theme: 'dark' | 'light'): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    // In a dark UI the status bar icons should be light, and vice versa.
    await StatusBar.setStyle({ style: theme === 'dark' ? Style.Dark : Style.Light })
    // Android only: tint the status bar background to match the app chrome.
    try {
      await StatusBar.setBackgroundColor({
        color: theme === 'dark' ? '#0d0f14' : '#f6f7fa',
      })
    } catch {
      // setBackgroundColor is unsupported on iOS; ignore.
    }
  } catch {
    // ignore
  }
}

/**
 * Register a handler for the Android hardware back button.
 * `onBack` should return true if it handled navigation, false to allow the app
 * to exit when there's no history. Returns an unsubscribe function.
 */
export async function registerBackButton(
  onBack: () => boolean,
): Promise<() => void> {
  if (!isNativeApp()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('backButton', ({ canGoBack }) => {
      const handled = onBack()
      if (!handled && !canGoBack) {
        App.exitApp()
      }
    })
    return () => {
      handle.remove().catch(() => {})
    }
  } catch {
    return () => {}
  }
}

/**
 * Subscribe to app resume/active state changes (e.g. to refresh data when the
 * user returns to the app). Returns an unsubscribe function.
 */
export async function onAppResume(callback: () => void): Promise<() => void> {
  if (!isNativeApp()) return () => {}
  try {
    const { App } = await import('@capacitor/app')
    const handle = await App.addListener('appStateChange', ({ isActive }) => {
      if (isActive) callback()
    })
    return () => {
      handle.remove().catch(() => {})
    }
  } catch {
    return () => {}
  }
}

export type HapticStyle = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error'

/** Trigger haptic feedback. No-op on web. */
export async function haptic(style: HapticStyle = 'medium'): Promise<void> {
  if (!isNativeApp()) return
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics')
    if (style === 'success' || style === 'warning' || style === 'error') {
      const type =
        style === 'success'
          ? NotificationType.Success
          : style === 'warning'
            ? NotificationType.Warning
            : NotificationType.Error
      await Haptics.notification({ type })
      return
    }
    const impact =
      style === 'light'
        ? ImpactStyle.Light
        : style === 'heavy'
          ? ImpactStyle.Heavy
          : ImpactStyle.Medium
    await Haptics.impact({ style: impact })
  } catch {
    // ignore
  }
}
