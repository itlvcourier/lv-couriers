# Capacitor Mobile App Setup Guide (Android + iOS)

This guide turns the LV Couriers web app into native Android and iOS apps using
Capacitor. The apps load your **live web app** inside a native shell, so any
change you deploy to the web instantly appears in the apps — no rebuild needed
(unless you change native config like icons, permissions, or plugins).

You do **not** need to know anything about Capacitor. Follow the steps in order.

---

## How this works (read this once)

- Your app is a server-rendered Next.js app (auth, API routes, SMS, email). It
  **cannot** be exported as static files, so we use Capacitor's **server URL**
  mode: the native app opens your hosted website and injects native device APIs
  (camera, GPS, push, etc.) into it.
- The web app keeps working exactly as before in a browser. All native calls are
  feature-detected (`isNativeApp()`), so nothing breaks on the web.
- Update flow: deploy to Vercel as usual → users see changes immediately in the
  app. You only rebuild/resubmit the app when changing icons, splash, plugins,
  or OS permissions.

---

## What's already done in the codebase

- Capacitor + all plugins installed (`@capacitor/core`, `camera`, `geolocation`,
  `push-notifications`, `status-bar`, `splash-screen`, `haptics`, `app`,
  `share`, `browser`, `network`).
- `capacitor.config.ts` — reads the target URL from `CAP_SERVER_URL`.
- `lib/native/` — bridge layer (camera, geolocation, push, app-shell, share).
- `components/native/NativeAppProvider.tsx` — initializes native features on
  launch; mounted in `app/layout.tsx`.
- Native camera + gallery wired into `components/shared/CameraCapture.tsx`.
- Push backend: `device_tokens` table (created), `/api/push/register` route,
  and `lib/push/send.ts` sender (FCM HTTP v1).
- `capacitor-www/index.html` — offline fallback page.

---

## Prerequisites

| Tool | Android | iOS |
|------|---------|-----|
| Node.js 20+ | Yes | Yes |
| Android Studio (latest) | Yes | No |
| Xcode (latest) | No | Yes (Mac only) |
| CocoaPods (`sudo gem install cocoapods`) | No | Yes |

You said you have both Windows and a Mac — build Android on either, build iOS on the Mac.

---

## STEP 1 — Set the server URL

The app needs to know which URL to load.

### For local testing (recommended first)
1. Find your computer's LAN IP:
   - Windows: `ipconfig` → look for "IPv4 Address" (e.g. `192.168.1.50`)
   - Mac: `ipconfig getifaddr en0`
2. Start the dev server bound to all interfaces:
   ```bash
   pnpm dev --hostname 0.0.0.0
   ```
3. Set the env var (in a `.env` file at the project root, or your shell):
   ```bash
   CAP_SERVER_URL=http://192.168.1.50:3000
   ```
   Your phone/emulator and computer must be on the same Wi-Fi.

### For production (later)
```bash
CAP_SERVER_URL=https://your-app.vercel.app
```
> Note: `capacitor.config.ts` allows cleartext (http) so local testing works.
> For production always use your `https://` Vercel URL.

---

## STEP 2 — Initialize native platforms

From the project root:

```bash
# Build the offline fallback dir is already present (capacitor-www).
npx cap add android      # creates the android/ folder
npx cap add ios          # Mac only — creates the ios/ folder
npx cap sync             # installs plugins into the native projects
```

Run `npx cap sync` again any time you install a new Capacitor plugin or change
`capacitor.config.ts`.

---

## STEP 3 — Add OS permissions

### Android — `android/app/src/main/AndroidManifest.xml`
Inside `<manifest>` (above `<application>`), add:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

### iOS — `ios/App/App/Info.plist`
Add these keys (the text is shown to the user in the permission prompt):
```xml
<key>NSCameraUsageDescription</key>
<string>Used to capture proof-of-delivery photos.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Used to attach photos from your library.</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>Used to save delivery photos.</string>
<key>NSLocationWhenInUseUsageDescription</key>
<string>Used to share your location for deliveries.</string>
```

---

## STEP 4 — Run on a device / emulator

### Android
```bash
npx cap open android      # opens Android Studio
```
In Android Studio: pick an emulator or a connected phone (USB debugging on) and
press Run. The app launches and loads your `CAP_SERVER_URL`.

### iOS (Mac)
```bash
npx cap open ios          # opens Xcode
```
In Xcode: select a simulator or your iPhone, set your Apple ID under
Signing & Capabilities, and press Run.

At this point camera, GPS, status bar, splash, haptics, and share all work.
Push needs Step 5.

---

## STEP 5 — Push notifications (optional, do last)

Push uses Firebase Cloud Messaging (FCM) for **both** Android and iOS.

### 5a. Create a Firebase project
1. Go to https://console.firebase.google.com → Add project.
2. Add an **Android app**: package name must match `appId` in
   `capacitor.config.ts` (`ca.lvcourier.app`). Download `google-services.json`
   and place it in `android/app/`.
3. (iOS) Add an **iOS app**: bundle id = same `ca.lvcourier.app`. Download
   `GoogleService-Info.plist` and drag it into `ios/App/App` in Xcode.

### 5b. iOS only — APNs key
1. In the Apple Developer portal, create an APNs Auth Key (.p8).
2. Upload it in Firebase → Project Settings → Cloud Messaging → Apple app config.

### 5c. Server credentials (so the backend can send push)
1. Firebase → Project Settings → Service accounts → Generate new private key.
   This downloads a JSON file.
2. Add these env vars to your Vercel project (Settings → Vars):
   - `FIREBASE_PROJECT_ID` — `project_id` from the JSON
   - `FIREBASE_CLIENT_EMAIL` — `client_email` from the JSON
   - `FIREBASE_PRIVATE_KEY` — `private_key` from the JSON (keep the `\n`s)

### 5d. Send a push from your code
Anywhere on the server (e.g. when a job is assigned):
```ts
import { sendPushToUsers } from '@/lib/push/send'

await sendPushToUsers([driverUserId], {
  title: 'New delivery assigned',
  body: 'Tap to view the details.',
  data: { route: '/driver/jobs' },
})
```
If the Firebase env vars aren't set, this safely does nothing (no crash).

---

## STEP 6 — App icon & splash screen (optional)

```bash
pnpm add -D @capacitor/assets
# put a 1024x1024 icon.png and 2732x2732 splash.png in an assets/ folder
npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#ffffff'
npx cap sync
```

---

## STEP 7 — Build for the stores (when ready)

> You said you just want it running locally first — come back to this later.

- **Android**: in Android Studio → Build → Generate Signed Bundle (.aab) → upload
  to Google Play Console (one-time $25 account).
- **iOS**: in Xcode → Product → Archive → Distribute App → App Store Connect
  (Apple Developer account $99/yr).

Remember to set `CAP_SERVER_URL` to your **production** `https://` URL and run
`npx cap sync` before building a release.

---

## Daily workflow cheatsheet

| You changed... | What to do |
|----------------|-----------|
| Web app code (pages, logic, styles) | Just deploy to Vercel — apps update instantly |
| `capacitor.config.ts` or installed a plugin | `npx cap sync` |
| App icon / splash | regenerate assets → `npx cap sync` |
| OS permissions | edit manifest/Info.plist → rebuild |
| Anything for the stores | rebuild + resubmit |

---

## Troubleshooting

- **Blank screen on launch**: phone can't reach `CAP_SERVER_URL`. Confirm same
  Wi-Fi, correct LAN IP, and dev server started with `--hostname 0.0.0.0`.
- **Camera/GPS does nothing**: permission was denied — enable it in the device's
  app settings, or check Step 3 was completed.
- **Push not arriving**: verify `google-services.json` / `GoogleService-Info.plist`
  are in place and the three `FIREBASE_*` env vars are set in Vercel.
