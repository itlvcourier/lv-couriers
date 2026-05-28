# Capacitor Mobile App Setup Guide (Android + iOS) — Full Detailed Walkthrough

This guide turns the **LV Couriers (DOMS)** web app into native **Android** and
**iOS** apps using **Capacitor**. It assumes you have **never used Capacitor,
Android Studio, or Xcode before**. Every step lists the exact command, the exact
file path, and the exact buttons to click.

Read the two short concept sections first, then follow the numbered steps **in
order**. Do not skip steps — later steps depend on earlier ones.

---

## TABLE OF CONTENTS

- [Part A — Core concepts (read once)](#part-a--core-concepts-read-once)
- [Part B — What is already done for you](#part-b--what-is-already-done-for-you)
- [Part C — Glossary of terms](#part-c--glossary-of-terms)
- [STEP 0 — Install all prerequisite software](#step-0--install-all-prerequisite-software)
- [STEP 1 — Set the server URL (`CAP_SERVER_URL`)](#step-1--set-the-server-url-cap_server_url)
- [STEP 2 — Create the native Android & iOS projects](#step-2--create-the-native-android--ios-projects)
- [STEP 3 — Add OS permissions](#step-3--add-os-permissions)
- [STEP 4 — Run the app on Android](#step-4--run-the-app-on-android)
- [STEP 5 — Run the app on iOS (Mac only)](#step-5--run-the-app-on-ios-mac-only)
- [STEP 6 — Push notifications (Firebase / FCM)](#step-6--push-notifications-firebase--fcm)
- [STEP 7 — App icon & splash screen](#step-7--app-icon--splash-screen)
- [STEP 8 — Build & submit to the app stores](#step-8--build--submit-to-the-app-stores)
- [Daily workflow cheatsheet](#daily-workflow-cheatsheet)
- [Full troubleshooting guide](#full-troubleshooting-guide)
- [Command reference](#command-reference)

---

## PART A — Core concepts (read once)

**1. Your app runs on a live server, the app is a "shell" around it.**
LV Couriers is a server-rendered Next.js app — it uses Supabase auth, API
routes, Twilio SMS, Resend email, and a Postgres database. That kind of app
**cannot** be packaged as static files inside a phone app. So instead, the
native app is a thin **shell**: when opened, it loads your live website (your
Vercel URL) inside a full-screen, chrome-less web view, and injects native
device features (camera, GPS, push) into it.

**2. Web changes appear in the apps instantly.**
Because the app loads your live site, anything you deploy to Vercel shows up in
the installed apps immediately — **no app rebuild, no resubmission**. You only
rebuild the native app when you change something *native*: the app icon, splash
screen, OS permissions, or add a new Capacitor plugin.

**3. The web app is never broken by any of this.**
Every native feature is wrapped in a check called `isNativeApp()`. In a normal
browser that check is `false`, so the app behaves exactly as it always has. The
native code only activates inside the real phone app.

**Diagram of the update flow:**
```
You edit code in v0  ->  Deploy to Vercel  ->  Live site updates
                                                     |
                  Android app  <----- loads ---------+
                  iOS app      <----- loads ---------+
              (users see the change next time they open the app)
```

---

## PART B — What is already done for you

You do **not** need to write any code for the items below — they already exist
in this repository:

| Item | File / location | What it does |
|------|-----------------|--------------|
| Capacitor + all plugins installed | `package.json` | core, cli, android, ios, camera, geolocation, push-notifications, status-bar, splash-screen, haptics, app, share, browser, network |
| Capacitor configuration | `capacitor.config.ts` | App id `ca.lvcourier.app`, name "LV Couriers", reads the live URL from `CAP_SERVER_URL` |
| Native bridge layer | `lib/native/` | `camera.ts`, `geolocation.ts`, `push.ts`, `app-shell.ts`, `share.ts`, `index.ts` — all feature-detected |
| Native initializer | `components/native/NativeAppProvider.tsx` | Runs on launch: themes the status bar, hides the splash, handles the Android back button, registers push after login. Mounted in `app/layout.tsx` |
| Native camera wiring | `components/shared/CameraCapture.tsx` | Uses the OS camera & gallery inside the app, falls back to the web camera in a browser |
| Push token API | `app/api/push/register/route.ts` | Stores/removes this device's push token (auth-scoped) |
| Push token table | Supabase `device_tokens` table | One row per device, protected by Row Level Security |
| Push sender | `lib/push/send.ts` | Sends notifications via Firebase Cloud Messaging (FCM HTTP v1); safely does nothing if Firebase isn't configured |
| Logout cleanup | `lib/context.tsx` | Unregisters the device's push token on logout |
| Offline fallback page | `capacitor-www/index.html` | Shown if the phone can't reach your server |

Your job is everything below: install the tools, generate the native projects,
set permissions, run them, and (optionally) wire up push + publish.

---

## PART C — Glossary of terms

- **Capacitor** — the tool that wraps your web app in a native app shell and
  gives it access to device features.
- **Native project** — the actual Android (`android/`) and iOS (`ios/`) app
  source code that Capacitor generates for you. You open these in Android Studio
  / Xcode to build the app.
- **Emulator / Simulator** — a fake phone running on your computer for testing
  (Android calls it an *emulator*, Apple calls it a *simulator*).
- **SDK** — Software Development Kit; the set of tools and libraries needed to
  build for a platform (Android SDK, iOS SDK).
- **`appId` / bundle id / package name** — the unique reverse-domain identifier
  of your app. For this project it is **`ca.lvcourier.app`**. It must match
  everywhere (Capacitor, Firebase, the stores).
- **APK / AAB** — Android app file formats. APK = installable test build, AAB =
  the bundle you upload to Google Play.
- **FCM** — Firebase Cloud Messaging, the free Google service that delivers push
  notifications to both Android and iOS.
- **APNs** — Apple Push Notification service, Apple's push gateway (FCM talks to
  it for you).
- **LAN IP** — your computer's local network address (like `192.168.1.50`), used
  so your phone can reach your dev server over Wi-Fi.

---

## STEP 0 — Install all prerequisite software

Do this once per computer. You only need the Android tools to build Android, and
a Mac with Xcode to build iOS.

### 0.1 — Node.js (required on every computer)

1. Go to https://nodejs.org and download the **LTS** version (20 or newer).
2. Run the installer, accept the defaults.
3. Verify in a terminal:
   ```bash
   node --version    # should print v20.x or higher
   ```

### 0.2 — pnpm (this project's package manager)

This repo uses **pnpm** (there is a `pnpm-lock.yaml`). Install it:
```bash
npm install -g pnpm
pnpm --version    # should print a version number
```

### 0.3 — Get the project onto your computer

If you are working from the v0 repository:
1. Connect the repo to GitHub (top-right settings in v0) or download the ZIP.
2. Open a terminal in the project folder (the folder that contains
   `package.json` and `capacitor.config.ts`).
3. Install dependencies:
   ```bash
   pnpm install
   ```

### 0.4 — Android Studio (for Android — works on Windows or Mac)

1. Download from https://developer.android.com/studio and run the installer.
2. On first launch, choose **Standard** setup. Let it download the Android SDK,
   SDK Platform, and an emulator image (this is a large download, be patient).
3. When it finishes, open **Settings/Preferences → Languages & Frameworks →
   Android SDK** and confirm at least one **SDK Platform** (e.g. Android 14) and
   **Android SDK Build-Tools** are checked/installed.
4. **Set up the JDK / JAVA_HOME** (Capacitor needs Java):
   - Android Studio ships with a JDK. Find its path in **Settings → Build,
     Execution, Deployment → Build Tools → Gradle → Gradle JDK**.
   - Easiest: always run `npx cap open android` and build *inside* Android
     Studio, which uses its bundled JDK automatically — then you don't need to
     configure `JAVA_HOME` manually.

### 0.5 — Create an Android emulator (optional but recommended)

1. In Android Studio open **Device Manager** (the phone icon on the right side,
   or **Tools → Device Manager**).
2. Click **Create Device** → pick e.g. **Pixel 7** → **Next**.
3. Choose a system image (e.g. Android 14 / API 34). If it shows a **Download**
   link next to it, click that first.
4. Click **Finish**. You now have a virtual phone you can launch.

### 0.6 — Xcode + CocoaPods (for iOS — Mac only)

1. Install **Xcode** from the Mac App Store (large download).
2. Open Xcode once and accept the license. Go to **Xcode → Settings → Locations**
   and make sure **Command Line Tools** is set to your Xcode version.
3. Install CocoaPods using Homebrew (the reliable method on modern Macs):
   ```bash
   brew install cocoapods
   pod --version    # confirms it installed
   ```
   > Do **not** use the old `sudo gem install cocoapods` — it frequently fails on
   > newer macOS because the system Ruby is locked down.
4. If you don't have Homebrew, install it first from https://brew.sh (one command
   they give you), then run the line above.

---

## STEP 1 — Set the server URL (`CAP_SERVER_URL`)

The native app needs to know which web address to load. This is controlled by an
environment variable named **`CAP_SERVER_URL`**, read inside
`capacitor.config.ts`.

You will use a **local URL** while testing and a **production URL** before
publishing.

### 1.1 — Local testing URL (do this first)

Your phone/emulator must load the dev server running on your computer, so you
point it at your computer's **LAN IP** (not `localhost` — `localhost` on a phone
means the phone itself).

1. Find your computer's LAN IP:
   - **Windows:** open Command Prompt, run `ipconfig`, look for **IPv4 Address**
     under your active Wi-Fi adapter (e.g. `192.168.1.50`).
   - **Mac:** run `ipconfig getifaddr en0` (Wi-Fi) — it prints the IP directly.
2. Create a file named **`.env`** in the project root (same folder as
   `package.json`) and add the line:
   ```bash
   CAP_SERVER_URL=http://192.168.1.50:3000
   ```
   Replace `192.168.1.50` with **your** IP from step 1.
3. Start the dev server so it accepts connections from other devices on the Wi-Fi
   (not just `localhost`):
   ```bash
   pnpm dev --hostname 0.0.0.0
   ```
   Leave this terminal running while you test.
4. **Both devices must be on the same Wi-Fi network.** A phone on cellular data
   cannot reach `192.168.x.x`.

> Why `http://` works locally: `capacitor.config.ts` automatically enables
> "cleartext" traffic when the URL starts with `http://`, and disables it for
> `https://`. You don't need to change anything.

### 1.2 — Production URL (used later, before publishing)

When you are ready to ship, change the value to your real, public HTTPS site:
```bash
CAP_SERVER_URL=https://app.lvcourier.ca
```
(or your `https://your-app.vercel.app` URL). Then re-run `npx cap sync`. More on
this in Step 8.

> The allowed domains are already listed in `capacitor.config.ts` under
> `allowNavigation`: `app.lvcourier.ca`, `*.lvcourier.ca`, `*.vercel.app`. If
> your production domain is different, add it there.

---

## STEP 2 — Create the native Android & iOS projects

These commands generate the `android/` and `ios/` folders. Run them from the
project root.

```bash
# 1. Android project (run on Windows or Mac)
npx cap add android

# 2. iOS project (Mac only — skip on Windows)
npx cap add ios

# 3. Copy web config + install all the native plugins into both projects
npx cap sync
```

What just happened:
- `npx cap add android` created the `android/` folder — a complete Android Studio
  project.
- `npx cap add ios` created the `ios/` folder — a complete Xcode project.
- `npx cap sync` copied your `capacitor.config.ts` settings into both, and
  installed the native side of every plugin (camera, geolocation, push, etc.).

> **Remember this rule:** any time you install a new Capacitor plugin, or edit
> `capacitor.config.ts`, run **`npx cap sync`** again. If you only changed your
> normal web app code, you do **not** need to sync.

---

## STEP 3 — Add OS permissions

Phones block camera, location, and notifications until your app declares it
needs them. Add the declarations below. (The user is still asked to approve each
one at runtime — these just make the request *possible*.)

### 3.1 — Android permissions

Open **`android/app/src/main/AndroidManifest.xml`**. Inside the `<manifest>` tag,
**above** the `<application>` tag, add:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<!-- Only if you track driver location while the app is in the background: -->
<uses-permission android:name="android.permission.ACCESS_BACKGROUND_LOCATION" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
<uses-feature android:name="android.hardware.camera" android:required="false" />
```

What each line is for:
- `INTERNET` — load your web app (required).
- `CAMERA` — proof-of-delivery photos.
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` — driver GPS **while the app
  is open**.
- `ACCESS_BACKGROUND_LOCATION` — GPS **while the app is minimized** (see the
  background note below; only add if you need it).
- `POST_NOTIFICATIONS` — show push notifications (Android 13+).
- `READ_MEDIA_IMAGES` — pick a photo from the gallery.
- `<uses-feature ... required="false">` — lets phones without a camera still
  install the app.

### 3.2 — iOS permissions

Open **`ios/App/App/Info.plist`** (in Xcode, or in a text editor). Add these keys
inside the top-level `<dict>`. The text strings are shown to the user in the
permission popup, so write them clearly:

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

For **background** location tracking on iOS, also add the "Always" keys (iOS
requires the When-In-Use key above **and** both Always keys), plus the
`location` background mode:

```xml
<key>NSLocationAlwaysAndWhenInUseUsageDescription</key>
<string>Used to keep your delivery location updated in the background.</string>
<key>NSLocationAlwaysUsageDescription</key>
<string>Used to keep your delivery location updated in the background.</string>
<key>UIBackgroundModes</key>
<array>
  <string>location</string>
</array>
```

### 3.3 — Important note on background location tracking

The installed `@capacitor/geolocation` plugin is reliable for **foreground** use
(getting/watching position while the driver has the app open). It does **not**
guarantee continuous updates once the app is minimized or the screen is locked,
because the OS suspends the web view.

If DOMS needs to keep tracking a driver during an active delivery while the app
is in the background, add a dedicated background plugin later:
```bash
pnpm add @capacitor-community/background-geolocation
npx cap sync
```
Then wire it into `lib/native/geolocation.ts` behind the same `isNativeApp()`
guard. **Recommendation:** get foreground tracking working first; only add
background mode once you confirm you need it, because both app stores scrutinize
background location closely (Google Play requires a written justification and a
demo video).

### 3.4 — How permissions actually work (two layers — already handled)

There are **two separate layers** to every device permission, and both are
required:

1. **Declaration** — listing the permission in `AndroidManifest.xml` (Step 3.1)
   and `Info.plist` (Step 3.2). This just tells the OS "this app may ask for
   X." On its own it does **not** grant anything.
2. **Runtime request** — at the moment the feature is used, the app must call
   the plugin's `requestPermissions()` so the OS shows the actual "Allow?" popup
   to the user. Without this call, the camera/GPS silently fails even though the
   manifest declares it.

> **You don't need to write this yourself — the bridge layer already does it.**
> The helpers in `lib/native/` call `checkPermissions()` and, if not yet
> granted, `requestPermissions()` at the right moment:
> - `lib/native/camera.ts` → `Camera.requestPermissions()` before opening the camera/gallery
> - `lib/native/geolocation.ts` → `Geolocation.requestPermissions()` before reading location
> - `lib/native/push.ts` → `PushNotifications.requestPermissions()` before registering
>
> So your only job is to make sure the **declarations** in Steps 3.1 / 3.2 are
> present. The runtime popups are triggered automatically the first time a
> driver uses each feature. (Exception: Android `ACCESS_BACKGROUND_LOCATION` and
> iOS "Always" location are upgrade prompts the user must approve from a settings
> screen — only relevant if you add background tracking per Step 3.3.)

---

## STEP 4 — Run the app on Android

1. Make sure your dev server is running (`pnpm dev --hostname 0.0.0.0`) and
   `CAP_SERVER_URL` points at your LAN IP (Step 1).
2. Open the Android project in Android Studio:
   ```bash
   npx cap open android
   ```
3. Wait for Android Studio to finish **Gradle sync** (progress bar at the
   bottom — the first time can take several minutes as it downloads build
   dependencies). Let it finish completely.
4. At the top, pick a target device from the dropdown:
   - your **emulator** (created in Step 0.5), **or**
   - a **real phone** connected by USB with **USB debugging** turned on
     (on the phone: Settings → About phone → tap "Build number" 7 times to unlock
     Developer options → enable **USB debugging**).
5. Click the green **Run ▶** button.
6. The app installs and launches. You should see the splash screen, then your
   live web app load. Log in and test camera, GPS, etc.

If you see a **blank/white screen**, the phone cannot reach your dev server — see
[Troubleshooting](#full-troubleshooting-guide).

---

## STEP 5 — Run the app on iOS (Mac only)

1. Dev server running, `CAP_SERVER_URL` set (Step 1).
2. Open the iOS project in Xcode:
   ```bash
   npx cap open ios
   ```
3. In Xcode's left sidebar, click the blue **App** project at the top, select the
   **App** target, open the **Signing & Capabilities** tab:
   - Check **Automatically manage signing**.
   - Under **Team**, select your Apple ID. (Add it via **Xcode → Settings →
     Accounts → +** if it's not listed — a free Apple ID works for running on
     your own device/simulator.)
4. At the top, choose a target device:
   - an **iOS Simulator** (e.g. iPhone 15), **or**
   - your **iPhone** connected by cable (you may need to "Trust" the computer on
     the phone, and enable Developer Mode on iOS 16+).
5. Click the **Run ▶** button.
6. The app builds, installs, and launches. Test the live app and features.

> Note: the camera does **not** work on the iOS Simulator (no hardware camera) —
> test camera on a real iPhone. GPS can be simulated via **Features → Location**
> in the Simulator menu.

---

## STEP 6 — Push notifications (Firebase / FCM)

This is the most involved step and is **optional** — everything else (camera,
GPS, status bar, splash, haptics, share) works without it. Do this only when you
want to send notifications that reach drivers even when the app is closed.

Push for **both** Android and iOS goes through **Firebase Cloud Messaging
(FCM)**, which is **free with no message limits**.

### 6.1 — Create a Firebase project

1. Go to https://console.firebase.google.com and sign in with a Google account.
2. Click **Add project**, give it a name (e.g. "LV Couriers"), continue through
   the steps (you can disable Google Analytics if you like), and **Create
   project**.

### 6.2 — Register the Android app in Firebase

1. In your Firebase project, click the **Android** icon to add an Android app.
2. **Android package name:** enter exactly **`ca.lvcourier.app`** (must match
   `appId` in `capacitor.config.ts`).
3. Register the app, then **download `google-services.json`**.
4. Place that file at **`android/app/google-services.json`** in your project.
5. Run `npx cap sync` so the build picks it up.

### 6.3 — Register the iOS app in Firebase (Mac / iOS only)

1. In Firebase, click **Add app → iOS**.
2. **iOS bundle ID:** enter exactly **`ca.lvcourier.app`**.
3. Download **`GoogleService-Info.plist`**.
4. In Xcode, drag that file into the **App/App** folder in the left sidebar.
   When prompted, check **Copy items if needed** and make sure the **App** target
   is ticked.

### 6.4 — iOS only: create an APNs key and give it to Firebase

Apple requires a push key so Firebase can deliver to iPhones:
1. Go to https://developer.apple.com/account → **Certificates, Identifiers &
   Profiles → Keys → +**.
2. Create a key, enable **Apple Push Notifications service (APNs)**, download the
   `.p8` file. Note the **Key ID** and your **Team ID**.
   > **⚠️ You can only download the `.p8` file ONCE.** Apple will never let you
   > re-download it. Immediately back it up somewhere secure and durable — a
   > password manager (1Password, Bitwarden) or your team's secrets vault — **not**
   > just a local Downloads folder that could be wiped. If you lose it, you must
   > revoke the key and create a new one, then re-upload it to Firebase.
3. In Firebase → **Project Settings → Cloud Messaging → Apple app configuration**,
   upload the `.p8`, and enter the Key ID and Team ID.
   > Note: real iOS push requires a **paid Apple Developer account ($99/yr)** and
   > testing on a **real device** (the Simulator can't receive push).

### 6.5 — Give your server permission to send (service account)

Your backend (`lib/push/send.ts`) needs credentials to call FCM:
1. Firebase → **Project Settings → Service accounts → Generate new private key**.
   This downloads a JSON file. **Keep it secret** — never commit it.
2. Open that JSON and copy three values into your Vercel project's environment
   variables (in v0: top-right settings → **Vars**; in Vercel: **Settings →
   Environment Variables**):
   - `FIREBASE_PROJECT_ID` → the `project_id` value
   - `FIREBASE_CLIENT_EMAIL` → the `client_email` value
   - `FIREBASE_PRIVATE_KEY` → the `private_key` value, **including** the
     `-----BEGIN PRIVATE KEY-----` header and all `\n` characters exactly as they
     appear
     > **⚠️ Most common mistake here.** Copy the value EXACTLY as it appears in
     > the JSON, keeping every literal `\n` intact — do not convert them to real
     > line breaks, and do not strip the `-----BEGIN/END PRIVATE KEY-----` lines.
     > When pasting into the Vercel/v0 env var field, paste the whole single-line
     > string with the `\n` characters in it. The sender code in `lib/push/send.ts`
     > converts those `\n` back into real newlines at runtime. If push fails with
     > an "invalid key" / "DECODER" error, this is almost always the cause.
3. Redeploy so the new env vars take effect.

### 6.6 — Send a test push from your code

Anywhere on the server (for example, when a job is assigned to a driver):
```ts
import { sendPushToUsers } from '@/lib/push/send'

await sendPushToUsers([driverUserId], {
  title: 'New delivery assigned',
  body: 'Tap to view the details.',
  data: { route: '/driver/jobs' }, // optional payload your app can read
})
```
If the `FIREBASE_*` env vars are not set, this call **safely does nothing** and
does not crash — so it's safe to add now and configure Firebase later.

### 6.7 — How the pieces connect (reference)

```
Driver opens app & logs in
   -> NativeAppProvider registers the device with the OS
   -> OS returns a push token
   -> app POSTs it to /api/push/register  -> saved in Supabase device_tokens

You call sendPushToUsers([driverId], {...})
   -> lib/push/send.ts looks up that driver's tokens
   -> sends to FCM  -> FCM delivers to Android directly, and to Apple's APNs for iOS
   -> notification appears on the driver's phone

Driver logs out
   -> token is removed from device_tokens (so they stop getting that account's push)
```

---

## STEP 7 — App icon & splash screen

Give the app a real icon and launch screen.

1. Install the asset generator:
   ```bash
   pnpm add -D @capacitor/assets
   ```
2. Create a folder named `assets/` in the project root and add:
   - `icon.png` — **1024 × 1024** px, square, no transparency for best results.
   - `splash.png` — **2732 × 2732** px (centered logo on a solid background).
3. Generate all the required sizes for both platforms:
   ```bash
   npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#0d0f14'
   ```
   (The splash background `#0d0f14` matches the value already set in
   `capacitor.config.ts`.)
4. Sync into the native projects:
   ```bash
   npx cap sync
   ```
5. Re-run the app (Step 4 / 5) to see the new icon and splash.

---

## STEP 8 — Build & submit to the app stores

Do this only when you're ready to release publicly.

### 8.1 — ⚠️ FIRST: switch to the production URL

Before **any** release build:
1. Edit `.env` and set the production URL:
   ```bash
   CAP_SERVER_URL=https://app.lvcourier.ca
   ```
2. Run:
   ```bash
   npx cap sync
   ```
3. Open `capacitor.config.ts`'s effective value or the native project and confirm
   the URL is the HTTPS production one.

> If you forget this, you will ship a store build that tries to load
> `http://192.168.x.x:3000` and shows a **blank screen for every user**.

### 8.2 — Android release (Google Play)

1. Create a **Google Play Console** account at
   https://play.google.com/console — one-time **$25** fee.
2. In Android Studio: **Build → Generate Signed Bundle / APK → Android App Bundle
   (.aab)**.
3. Create a new **keystore** when prompted (this signs your app — back it up and
   never lose it; you need the same key for every future update). Save the
   passwords somewhere safe.
4. Build the release **.aab** file.
5. In Play Console: create your app, fill in store listing, content rating,
   privacy policy, then upload the `.aab` to a release track (start with
   **Internal testing**).

### 8.3 — iOS release (App Store) — Mac only

1. Enroll in the **Apple Developer Program** at https://developer.apple.com —
   **$99/year**.
2. In Xcode, select **Any iOS Device** as the build target.
3. **Product → Archive**. When the Organizer opens, click **Distribute App →
   App Store Connect**.
4. In https://appstoreconnect.apple.com, create the app record, fill in the
   listing, screenshots, privacy details, then submit the build for review.

### 8.4 — Store review note on background location

If you declared `ACCESS_BACKGROUND_LOCATION` (Android) or the Always location
keys (iOS), both stores will ask you to **justify background location use**
during review. Prepare a short written explanation, and for Google Play, a short
**demo video** showing why background tracking is needed (active delivery
tracking). If you do not actually use background location, remove those entries
to avoid review delays.

---

## Daily workflow cheatsheet

| You changed... | What to do |
|----------------|-----------|
| Web app code (pages, logic, styles, content) | Just deploy to Vercel — installed apps update on next open. **No rebuild.** |
| Installed a new Capacitor plugin, or edited `capacitor.config.ts` | `npx cap sync`, then rebuild in Android Studio / Xcode |
| App icon or splash screen | Regenerate assets (Step 7) → `npx cap sync` → rebuild |
| OS permissions (manifest / Info.plist) | Edit the file → rebuild |
| Anything that needs to reach end users on the stores | Rebuild + resubmit to the store |
| Switched between local and production testing | Update `CAP_SERVER_URL` in `.env` → `npx cap sync` → rebuild |

---

## Full troubleshooting guide

**Blank or white screen when the app launches**
- The phone can't reach `CAP_SERVER_URL`.
- Confirm the dev server is running with `pnpm dev --hostname 0.0.0.0` (not plain
  `pnpm dev`).
- Confirm phone and computer are on the **same Wi-Fi**.
- Confirm the IP in `.env` matches your current LAN IP (it changes when you switch
  networks).
- Did you run `npx cap sync` after editing `.env`? Do it, then rebuild.
- Some corporate/guest Wi-Fi networks block device-to-device traffic; try a phone
  hotspot or home Wi-Fi.

**"Gradle sync failed" / Android build errors**
- Let Android Studio finish its first-time downloads completely before building.
- **File → Invalidate Caches / Restart** often fixes transient issues.
- Make sure an SDK Platform and Build-Tools are installed (Step 0.4).

**Camera or GPS does nothing / immediately fails**
- The permission was denied. On the device: **Settings → Apps → LV Couriers →
  Permissions** and enable Camera / Location. Then relaunch.
- Confirm Step 3 permission entries were added and you rebuilt.
- iOS Simulator has no camera — test camera on a real iPhone.

**Push notifications not arriving**
- Confirm `google-services.json` is at `android/app/` and/or
  `GoogleService-Info.plist` is added to the Xcode App target.
- Confirm `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
  are set in Vercel and you redeployed.
- The `FIREBASE_PRIVATE_KEY` must keep its `\n` line breaks intact.
- iOS push requires a paid Apple Developer account, a valid APNs key uploaded to
  Firebase, and a **real device** (not the Simulator).
- The user must have logged in at least once in the app (that's when the token is
  registered).

**`pod install` fails on Mac**
- Reinstall CocoaPods via Homebrew: `brew install cocoapods`.
- In the `ios/App` folder, run `pod repo update` then `pod install`.

**`npx cap open android` / `ios` does nothing**
- Make sure you ran `npx cap add android` / `npx cap add ios` first (Step 2).
- Make sure Android Studio / Xcode is actually installed (Step 0).

**Changes to my web app aren't showing in the app**
- The app loads your **deployed** site. Make sure your change is deployed to the
  URL in `CAP_SERVER_URL` (for local testing, that's your running dev server).
- Fully close and reopen the app, or pull-to-refresh if your page supports it.

---

## Command reference

```bash
# One-time install
pnpm install

# Create native projects
npx cap add android
npx cap add ios            # Mac only

# Sync after ANY native change (plugin install or capacitor.config.ts edit)
npx cap sync

# Open the IDEs
npx cap open android
npx cap open ios           # Mac only

# Run the dev server reachable by your phone
pnpm dev --hostname 0.0.0.0

# App icon + splash (after putting images in assets/)
pnpm add -D @capacitor/assets
npx @capacitor/assets generate --iconBackgroundColor '#ffffff' --splashBackgroundColor '#0d0f14'

# Optional: background GPS tracking (only if needed)
pnpm add @capacitor-community/background-geolocation
npx cap sync
```
