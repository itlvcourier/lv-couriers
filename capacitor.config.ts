import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Capacitor configuration for LV Couriers (DOMS).
 *
 * IMPORTANT — Hosted server mode:
 * This app is a server-rendered Next.js app (Supabase auth, API routes, Twilio,
 * Resend, Postgres). It cannot be statically exported. Instead, the native shell
 * loads the LIVE web app from a URL. This means any change deployed to the web
 * reflects in the apps instantly, with no native rebuild.
 *
 * The URL is read from the CAP_SERVER_URL environment variable so you can point
 * the same project at:
 *   - your local dev machine while testing, e.g. http://192.168.1.50:3000
 *   - your production domain for release builds, e.g. https://app.lvcourier.ca
 *
 * If CAP_SERVER_URL is not set, no server.url is emitted (Capacitor would then
 * expect bundled web assets — only relevant if you ever switch to static export).
 */

const serverUrl = process.env.CAP_SERVER_URL?.trim()

// Allow cleartext (http) only when explicitly pointing at a local http dev server.
const isCleartext = !!serverUrl && serverUrl.startsWith('http://')

const config: CapacitorConfig = {
  appId: 'ca.lvcourier.app',
  appName: 'LV Couriers',
  // webDir is only used when bundling static assets. In hosted-server mode it is
  // unused, but Capacitor still requires the field to exist. We point it at a
  // lightweight folder that contains a fallback page.
  webDir: 'capacitor-www',
  server: serverUrl
    ? {
        url: serverUrl,
        cleartext: isCleartext,
        // Allow navigation within your own domain(s). Add production + preview here.
        allowNavigation: [
          'app.lvcourier.ca',
          '*.lvcourier.ca',
          '*.vercel.app',
        ],
      }
    : undefined,
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#0d0f14',
      showSpinner: false,
      androidScaleType: 'CENTER_CROP',
      splashFullScreen: true,
      splashImmersive: true,
    },
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
  android: {
    // Permits http traffic to a local dev server during development only.
    allowMixedContent: isCleartext,
  },
  ios: {
    contentInset: 'always',
    limitsNavigationsToAppBoundDomains: false,
  },
}

export default config
