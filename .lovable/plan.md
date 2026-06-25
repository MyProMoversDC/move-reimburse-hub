## Goal

Make production Capacitor builds load only from bundled `dist/`, never from `lovableproject.com`. App must launch at `/auth`. Produce a new AAB and a new TestFlight build, with `versionCode` strictly increasing every release.

## 1. `capacitor.config.ts` — strip the hardcoded preview URL

Replace the file with an env-gated `server.url`. Production CI never sets `CAP_SERVER_URL`, so no `server` block is emitted and Capacitor falls back to `webDir: 'dist'`.

```ts
import type { CapacitorConfig } from '@capacitor/cli';

// Production: no CAP_SERVER_URL -> loads bundled dist/ -> app boots at /auth.
// Local hot-reload only:
//   CAP_SERVER_URL="https://<sandbox>.lovableproject.com?forceHideBadge=true" npx cap sync
const devServerUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.mypromovers.app',
  appName: 'My Pro Movers',
  webDir: 'dist',
  ...(devServerUrl ? { server: { url: devServerUrl, cleartext: true } } : {}),
  android: { buildOptions: { releaseType: 'AAB' } },
  ios: {
    contentInset: 'always',
    scheme: 'My Pro Movers',
    limitsNavigationsToAppBoundDomains: false,
    backgroundColor: '#ffffff',
  },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
  },
};

export default config;
```

## 2. `index.html` — remove `lovable.dev` OG/Twitter URLs

Replace the sandbox UUID OG title and the two `https://lovable.dev/opengraph-image-p98pqg.png` references with My Pro Movers branding. No remote Lovable URLs remain in the shipped HTML.

## 3. New `.github/workflows/android-build.yml` — cloud AAB builds

Key behaviors per your adjustment:

- **Never recreates the Android project** when one already exists:
  ```yaml
  - name: Add Android platform if missing
    run: |
      if [ ! -d "android" ]; then
        npx cap add android
      else
        echo "android/ already present — preserving existing native project"
      fi
  - name: Sync Capacitor (Android)
    run: npx cap sync android
  ```
  Normal builds only run `npx cap sync android`, which updates the web bundle and plugin config without overwriting your native customizations.

- **Monotonic `versionCode`**: uses `${{ github.run_number }}`. GitHub guarantees this strictly increases per repo per workflow, so every accepted Play upload bumps it. `versionName` defaults to `1.0.<run_number>` and is overridable via `workflow_dispatch` input.

- **Pre-build guard**: greps the repo for `lovableproject.com` and fails the job before doing any work if found.

- **Post-sync guard**: greps the synced `android/` tree and inspects `android/app/src/main/assets/capacitor.config.json` to confirm no `"url"` key is present (i.e. no remote server). Fails the build if found.

- **Clean build**: `rm -rf dist` then `npm run build` then `npx cap sync android`.

- **Signing**: decodes keystore from `ANDROID_KEYSTORE_BASE64`, patches `android/app/build.gradle` to add a `signingConfigs.release` block wired to env vars (only if not already present — idempotent), runs `./gradlew bundleRelease`.

- **Outputs**: uploads the AAB as a workflow artifact named `mypromovers-release-<versionName>-<versionCode>`. If `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` secret exists, also pushes to the Play Internal Testing track via `r0adkll/upload-google-play@v1`. If absent, you download the artifact and upload manually in Play Console.

Required GitHub secrets:
- `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
- `GOOGLE_SERVICES_JSON_BASE64` (Firebase Android config)
- *(optional)* `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

## 4. iOS — existing `.github/workflows/ios-build.yml` already correct

It does `npm ci` → `npm run build` → `npx cap sync ios` → archive → TestFlight. No `cap add ios` on every run (`ios/App` is committed). Build number derives from `github.run_number`. As soon as the capacitor.config.ts change lands on `main`, the next push triggers a clean TestFlight build provided the 8 iOS secrets are configured. I'll add the same pre-build "no preview URL" guard to this workflow too, for parity.

## 5. Verification (executed by CI + manual)

CI:
1. Pre-build grep guard fails the job if any `lovableproject.com` reference exists in build inputs.
2. Post-`cap sync` guard fails if the generated `capacitor.config.json` inside `android/` (or `ios/`) contains a `"url"` field.

Manual on a fresh device:
1. Uninstall any prior version. Install the new build from Play Internal Testing / TestFlight.
2. With Chrome DevTools (`chrome://inspect`) attached to the Android device, or Safari Web Inspector for iOS:
   - Cold-start the app, watch the Network tab.
   - Confirm zero requests to any `*.lovableproject.com` host.
   - Confirm first rendered route is `/auth`.
3. Airplane-mode sanity: kill network briefly after launch — the auth screen must still render (proves assets are bundled, not remote).

## 6. Release flow after merge

Android:
1. `main` push triggers `android-build.yml` → AAB artifact ready (and optionally auto-pushed to Internal Testing).
2. If not auto-pushed: download AAB → Play Console → Internal testing → create release → upload → roll out.

iOS:
1. `main` push triggers `ios-build.yml` → build appears in App Store Connect → TestFlight in ~15 min.
2. Assign to internal testers → install via TestFlight → verify `/auth` first screen.

## Not changed

- No DB / RLS / edge-function changes.
- No UI changes anywhere in the app.
- Lovable AI gateway (`ai.gateway.lovable.dev`) and Resend connector (`connector-gateway.lovable.dev`) URLs inside `supabase/functions/**` remain — those are backend service endpoints, not preview URLs.
- `android/` is not recreated when it already exists, preserving any native customizations and your existing keystore wiring.
