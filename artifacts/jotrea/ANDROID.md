# Jotrea Android

Package: `com.sparky.jotrea`. Android release: version name **1.1**, version code **2**.
This is the existing Capacitor app, not an Expo or React Native rewrite.

## Mac prerequisites

- Node.js 22 and pnpm (the repository pins pnpm).
- Android Studio, Android SDK Platform 36 (plain API 36), and its SDK build tools.
- Android Gradle Plugin 8.9.2 with the existing Gradle 8.11.1 wrapper.
- JDK 21 (select Android Studio's bundled JDK 21 in Gradle settings, or install/select JDK 21).

## Get the changes without losing local iOS work

From the existing repository root, first run `git status`. Preserve any intentional
local changes, including Xcode changes, before pulling. Do not use `git reset --hard`,
`git clean`, or overwrite the iOS folder. If your working tree is clean, use
`git pull --ff-only`; if Git reports conflicts or local changes, stop and resolve
those rather than discarding them. Changes must first be pushed to your Git remote.

## Configure the Mac build key once

Replit Secrets do not transfer through Git. In `artifacts/jotrea/.env.local`, add:

```dotenv
VITE_REVENUECAT_ANDROID_API_KEY=YOUR_GOOGLE_PLAY_PUBLIC_SDK_KEY
```

Replace the placeholder with the **public** `goog_…` SDK key for Jotrea Android in
RevenueCat. Preserve existing entries, especially the iOS SDK key. This file is
ignored by Git. Do not use service-account JSON or RevenueCat secret API keys.
Vite embeds public SDK keys at build time; editing the value requires rebuilding.

## Prepare and open

From the repository root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @workspace/jotrea android:prepare
pnpm --filter @workspace/jotrea android:open
```

`android:prepare` checks that the Android SDK key is present, builds web assets
with the native root base path, then syncs **Android only**. It does not sync or
modify the iOS project. Repeat it after web code changes before running Android.

In Android Studio, let Gradle sync finish, then run on an emulator or Android phone.
The generated native project requires Android 6/API 23 or later.
The configuration targets Android 16/API 36 to meet the Google Play new-app
requirement effective August 31, 2026. Build 1 targeted API 35 and was rejected;
use build 2 or later for the replacement upload. Installing an emulator image
does not install the SDK Platform package used to compile the app.

## Create the Google Play bundle

In Android Studio choose **Build → Generate Signed App Bundle / APK → Android App Bundle**.
Create or select your upload keystore, choose **release**, and finish the wizard.
Keep the keystore and passwords securely backed up outside Git; do not upload them
to chat. Enable Play App Signing during the Play Console release flow.
The output is normally `android/app/release/app-release.aab` (use the wizard's
actual destination). Upload it to Jotrea's **Internal testing** track.
Increment `versionCode` in `android/app/build.gradle` for each subsequent upload.

## Scope and remaining release checks

- Android selects the Google Play RevenueCat SDK key; iOS continues using its own key.
- Apple Health stays iOS-only. Health Connect is not implemented or bundled on Android.
- Essential manual tracking remains available; Android PDF/CSV sharing uses the native share sheet.
- Automatic Android backups are disabled for the local health-tracking data.
- Android reminders are best-effort. No exact-alarm special access is requested;
  battery management can delay delivery, as disclosed in Settings.
- Check first-run notification permission, reminders, reboot behavior, keyboard,
  system back navigation, status/navigation bar insets, PDF/CSV sharing, and offline
  persistence on a device. Companion medications must never schedule notifications.
- Configure Google Play subscriptions/base plans/offers and RevenueCat entitlement/
  offering mappings, then test purchase, restore, cancellation, and expiry using
  Play internal testers who are also billing license testers.
- Reviewer access, Play declarations, listing, and closed-testing requirements
  are separate release steps. No reviewer bypass has been added.

The Replit web build and Capacitor sync do not compile or sign an Android binary.
An Android Studio/Gradle build and on-device checks are required before release.