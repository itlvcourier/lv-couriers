'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import { useApp } from '@/lib/context'
import { isNativeApp } from '@/lib/native'
import {
  hideSplash,
  applyStatusBarTheme,
  registerBackButton,
  onAppResume,
} from '@/lib/native/app-shell'
import { initPushNotifications } from '@/lib/native/push'

/**
 * NativeAppProvider wires native-shell behavior into the running web app.
 * It renders nothing and is a complete no-op in a normal browser.
 *
 * Responsibilities:
 *  - Hide the splash screen once the app has mounted.
 *  - Keep the native status bar styled to match the current theme.
 *  - Handle the Android hardware back button (history-aware).
 *  - Register for push notifications once a user is logged in, and route to the
 *    notification's `url` when tapped (deep linking).
 */
export function NativeAppProvider() {
  const router = useRouter()
  const { resolvedTheme } = useTheme()
  const { currentUser } = useApp()
  const pushInitialized = useRef(false)

  // Hide splash + handle back button + app resume (run once).
  useEffect(() => {
    if (!isNativeApp()) return

    void hideSplash()

    let cleanupBack = () => {}
    let cleanupResume = () => {}

    registerBackButton(() => {
      // If the WebView can go back, let it; otherwise allow app exit.
      if (typeof window !== 'undefined' && window.history.length > 1) {
        router.back()
        return true
      }
      return false
    }).then((fn) => {
      cleanupBack = fn
    })

    onAppResume(() => {
      // Re-apply status bar styling on resume (some OSes reset it).
      void applyStatusBarTheme(resolvedTheme === 'light' ? 'light' : 'dark')
    }).then((fn) => {
      cleanupResume = fn
    })

    return () => {
      cleanupBack()
      cleanupResume()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  // Keep status bar in sync with theme changes.
  useEffect(() => {
    if (!isNativeApp()) return
    void applyStatusBarTheme(resolvedTheme === 'light' ? 'light' : 'dark')
  }, [resolvedTheme])

  // Register push notifications once a user is logged in.
  useEffect(() => {
    if (!isNativeApp() || !currentUser || pushInitialized.current) return
    pushInitialized.current = true
    void initPushNotifications({
      onTap: (data) => {
        const url = typeof data?.url === 'string' ? data.url : null
        if (url) router.push(url)
      },
    })
  }, [currentUser, router])

  return null
}
