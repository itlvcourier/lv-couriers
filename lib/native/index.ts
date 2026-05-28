import { Capacitor } from '@capacitor/core'

/**
 * Central helpers for detecting the runtime environment.
 *
 * Every native feature in `lib/native/*` is feature-detected through these
 * helpers so the exact same code runs in a normal browser (web fallback) and
 * inside the Capacitor native shell (native API).
 */

/** True when running inside the Capacitor native shell (Android or iOS). */
export function isNativeApp(): boolean {
  try {
    return Capacitor.isNativePlatform()
  } catch {
    return false
  }
}

/** 'android' | 'ios' | 'web' */
export function getPlatform(): 'android' | 'ios' | 'web' {
  try {
    return Capacitor.getPlatform() as 'android' | 'ios' | 'web'
  } catch {
    return 'web'
  }
}

export function isAndroid(): boolean {
  return getPlatform() === 'android'
}

export function isIOS(): boolean {
  return getPlatform() === 'ios'
}

/**
 * Converts a native file URI into a URL the WebView can actually load.
 * On web this is a no-op.
 */
export function toWebSrc(pathOrUri: string): string {
  try {
    return Capacitor.convertFileSrc(pathOrUri)
  } catch {
    return pathOrUri
  }
}
