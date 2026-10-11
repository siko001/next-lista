# Lista for Android and iOS

This Capacitor app bundles Lista's existing React screens and CSS. It does not load the website into a remote WebView. WordPress remains the source of truth for accounts, shopping lists and private revision markers. AI requests continue to use the hosted Next.js routes on Vercel. Internet access is required for data and AI features.

## Install the test APK on a Nothing Phone (3a)

The generated file is `mobile/artifacts/Lista-debug.apk`.

1. Transfer the APK to the phone (for example, through your own Drive account or a USB file-transfer tool).
2. Open the APK in Files/Downloads. If Android asks, open Settings and allow **Install unknown apps / Allow from this source** for the app opening the APK.
3. Return and tap **Install**, then open **Lista**. You can turn the source permission off again afterwards.
4. Log in with your existing Lista account to use the same lists as the website. Microphone access is requested when you start recording.

Android Studio alternative: enable Developer options and USB debugging on the phone, connect it, approve the computer on the phone, then select the device and Run the `app` configuration. You can also run `adb install -r mobile/artifacts/Lista-debug.apk` from the repository root.

Keep `mobile/.cache/debug.keystore` when rebuilding: the same signing key lets Android install updates over this test app. This is a development build, not a store release. No store submission or deployment is performed by these commands.

## Development

Install the repository dependencies first (`npm ci` in the repository root), then:

```sh
cd mobile
npm ci
npm run dev          # browser preview on http://127.0.0.1:4173
npm test             # session durability and URL boundary tests
npm run test:ui      # Chrome phone-layout tests with mocked WordPress/private sync/AI
npm run test:packaged # built Android/iOS startup with a simulated native bridge
npm run apk          # build, sync and produce artifacts/Lista-debug.apk
npm run android      # open the native project in Android Studio
```

The mobile package intentionally resolves the existing UI libraries from the repository root; it has a separate lockfile for native/build dependencies. No server environment file or AI secret is copied into the APK.

Android builds use SDK 36 and Java 21. The build script finds the installed JDK 21 on macOS and uses the SDK at `~/Library/Android/sdk`, or `ANDROID_HOME`. Gradle downloads/cache and the debug signing key live under `mobile/.cache/`. A compatible JDK can be supplied using `JAVA_HOME`.

For iOS, install Xcode 26 or newer, then `npm run sync` and `npm run ios`. Open `ios/App/App.xcodeproj`, choose your Apple development team and a simulator or device. The generated project uses Swift Package Manager. iOS compilation and device checks require Xcode; they cannot be verified using the command-line tools alone.

## Keeping desktop behaviour separate

- `src/App.jsx` supplies mobile page loading and mounts the existing providers and screens.
- `src/compat/` supplies mobile implementations of the small Next routing surface used by those screens.
- `src/session.js` adapts the existing cookie interface to iOS Keychain / Android Keystore, preserving expiration and guest-to-account transfer. Writes are flushed before login/logout navigation. Browser preview sessions use **sessionStorage only**.
- `src/platform.js` supplies hosted AI URLs, public share URLs, the native share sheet, clipboard and external browser.
- `src/realtime.js` uses the shared authenticated revision poller. It checks while visible/online, refreshes authorized data after a change, and pauses in the background. No Pusher connection is used.
- `src/runtime.js` handles native app links, resume/pause, connectivity and Android back behaviour.
- `src/mobile.css` is imported only by the mobile build. Fonts, launch artwork and icons are bundled locally.
- Shared screens call `app/lib/platform.mjs`; its web implementation retains existing browser behaviour. Vite substitutes the mobile implementation only in this build. Next's type checking excludes `mobile/`.

The native build reuses the UI; hosted API routes remain on Vercel. Full offline editing and closed-app push notifications are not included. Collaboration works while connected, with resynchronization on return.

## Live synchronization deployment

WordPress snippets 1764, 1769 and 1774 provide permission checks, private revision
markers and compatibility for legacy event callers. The old public broadcaster
is deactivated. See `../WP/security/README.md` for exact deployment sources.

Deploy the matching web client as well as the APK. Older clients still load and
save through authorized REST endpoints, but no longer receive public Pusher
updates. Version 0.1.2 checks its own revision marker every four seconds while
visible and online, then fetches permitted list data. Shared changes appear
within that polling interval. Closed-app push notifications are not included.

## Configuration and app links

`app.config.json` contains the public website and WordPress origins. Keep the app ID aligned with `capacitor.config.json` and the native projects if it changes. No credentials belong in either file.

Android/iOS link handling is configured for `https://next-lista.vercel.app/shared-list/...`, `/list/...` and `/reset-password...`. Public share links always use the Vercel origin, never the app's local `localhost` origin.

Opening a web link directly in the installed app additionally requires website association files tied to the app's signing identity. Until those are deployed, links continue to work in the website. Generate files locally with `npm run links` using `LISTA_ANDROID_SHA256` (signing certificate SHA-256 fingerprint) and/or `LISTA_APPLE_TEAM_ID`. The files are written under `association-files/.well-known/`; this does **not** publish them or modify the website. Use the Play signing certificate when preparing a future Play release.

Native icons/launch images are generated from the existing Lista SVG favicon with `node scripts/assets.mjs`.

## Later release builds

See [the Google Play release kit](release/README.md) for the privacy/deletion URLs, listing copy, data inventory, known backend blockers, and physical-device checks. The release kit records preparation, not store submission.

For local signing, run `npm run signing:setup` once. This creates an ignored `.signing/` folder and refuses to replace an existing key. Back up that entire folder securely. `npm run bundle` uses it automatically and writes `artifacts/Lista-release.aab`. `npm run store:assets` creates the Play icon and feature graphic; the UI suite generates representative screenshots.

For a signed Android bundle, supply `LISTA_KEYSTORE_PATH`, `LISTA_KEYSTORE_PASSWORD`, `LISTA_KEY_ALIAS`, and `LISTA_KEY_PASSWORD`, then run `npm run bundle`. Keep keys and passwords out of Git. iOS signing/distribution is managed in Xcode. Store metadata and policy preparation are separate from the working app.

Before releasing, verify microphone recording/upload, native sharing, secure-session persistence across process termination, and cross-device sharing on physical Android and iOS devices. Browser UI tests use controlled data and do not prove native plugin behaviour. Privacy and self-service deletion pages are prepared, including an email fallback. Guest account, access-control and deletion checks passed against the live backend. Public web deployment, provider-retention verification and physical-device checks remain as recorded in the release kit. Social sign-in is not part of this release.
