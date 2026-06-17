# My Pro Movers — iOS Setup (App Store + TestFlight)

This guide gets the app from the Lovable repo into TestFlight and the App Store **without owning a Mac**, using GitHub Actions as the cloud build pipeline.

- **App name:** My Pro Movers
- **Bundle ID:** `com.mypromovers.app` (same as Android `applicationId` — keeps Firebase unified)
- **Push:** Firebase Cloud Messaging → APNs (existing `send-push-notification` edge function works for both platforms; no schema changes)
- **Auth:** email/password + Google + **Apple Sign In** (required by Apple when any third-party social login is offered)

---

## 0. One-time costs / accounts

| Item | Cost | Where |
|---|---|---|
| Apple Developer Program | **$99/year** | https://developer.apple.com/programs/enroll/ |
| GitHub Actions macOS minutes | Free 2000 min/mo for private repos | already included |
| Firebase | Free Spark plan | https://console.firebase.google.com |

You cannot ship to the App Store without an active Apple Developer membership.

---

## 1. Apple Developer Portal (https://developer.apple.com/account)

### 1.1 App ID
Identifiers → **+** → App IDs → App.
- Description: My Pro Movers
- Bundle ID: **Explicit** → `com.mypromovers.app`
- Capabilities — enable:
  - ☑ Push Notifications
  - ☑ Sign In with Apple
  - ☑ Associated Domains (for future Universal Links — leave configured, harmless)

### 1.2 APNs Authentication Key (.p8)
Keys → **+** → name `MyProMovers APNs` → enable **Apple Push Notifications service (APNs)** → Register → Download.
- Save **`AuthKey_XXXXXXXXXX.p8`** (one-time download).
- Note the **Key ID** (10 chars) shown on the page.
- Note your **Team ID** (top-right of the portal).

### 1.3 Distribution Certificate (.p12)
The easiest no-Mac path is to let your cloud-build service create the cert via the App Store Connect API.

**Option A (recommended): App Store Connect API key**
1. https://appstoreconnect.apple.com → Users and Access → Integrations → App Store Connect API → Generate key with **Admin** role.
2. Save `.p8` + Issuer ID + Key ID.
3. Either Codemagic (auto-signing) or `fastlane match` from GitHub Actions can use this to fetch/create the cert on demand. No `.p12` to manage by hand.

**Option B: generate `.p12` once with a friend's Mac or a paid service (e.g. https://www.signing.io)**
1. Have someone with a Mac open Keychain Access → Certificate Assistant → Request a Certificate from a Certificate Authority → save the CSR.
2. Developer portal → Certificates → **+** → Apple Distribution → upload the CSR → download `.cer`.
3. On that Mac, double-click `.cer`, then export from Keychain as `.p12` with a password.
4. Send the `.p12` + password to yourself securely.

### 1.4 Provisioning Profile (App Store)
Profiles → **+** → Distribution → **App Store** → App ID `com.mypromovers.app` → choose the distribution certificate from 1.3 → Download `.mobileprovision`.

---

## 2. App Store Connect (https://appstoreconnect.apple.com)

### 2.1 Create the app record
My Apps → **+** → New App.
- Platform: iOS
- Name: **My Pro Movers**
- Primary language: English (U.S.)
- Bundle ID: `com.mypromovers.app`
- SKU: `mypromovers-ios` (any unique string)
- User Access: Full Access

Note the numeric **Apple ID** shown after creation (used in `codemagic.yaml` as `APP_STORE_APP_ID`).

### 2.2 App information
- Category: Business
- Privacy Policy URL: your live URL (required)
- Support URL: required

### 2.3 App Privacy questionnaire (required, blocking)
Click **Get Started**, then declare:
- **Contact Info** → Email, Phone, Name → linked to user → **App Functionality** → not used for tracking
- **Identifiers** → User ID, Device ID (push tokens) → linked to user → **App Functionality** → not used for tracking
- **Location** → Precise Location → linked to user → **App Functionality** (used for address/incident geocoding)
- **User Content** → Photos or Videos → linked to user → **App Functionality**
- **Diagnostics** → Crash Data, Performance Data → not linked → **App Functionality**
- Tracking: **No** — we do not track users across apps.

### 2.4 Screenshots and metadata
- App icon: 1024×1024 PNG, no transparency, no rounded corners.
- Screenshots: required **6.7" iPhone** (1290×2796) — minimum 3, recommended 5. Same set is reused for older device sizes by Apple.
- Description, keywords, what's new.
- Sign-in info for review team: provide a test account (mover role) with email + password.

---

## 3. Firebase iOS app

1. Firebase Console → your existing project → **Add app** → iOS+.
2. Bundle ID: `com.mypromovers.app`. App nickname: `My Pro Movers iOS`.
3. Download **`GoogleService-Info.plist`**.
4. Project Settings → **Cloud Messaging** → Apple app configuration → **Upload APNs Authentication Key**:
   - Upload the `.p8` from 1.2
   - Key ID + Team ID

That's it — the existing `send-push-notification` edge function already targets FCM v1 with both `android` and `apns` payload blocks, so iOS tokens are delivered automatically.

---

## 4. Apple Sign In (already enabled in Lovable Cloud)

Lovable Cloud has been configured to expose Apple Sign In. To wire it into the iOS app:

1. Apple Developer Portal → Identifiers → Services IDs → **+** → Services IDs.
2. Description: `My Pro Movers Web Auth`. Identifier: `com.mypromovers.app.signin`.
3. Enable **Sign In with Apple** → Configure:
   - Primary App ID: `com.mypromovers.app`
   - Domains: your Lovable Cloud auth domain (shown in the **View Backend → Auth Settings → Apple** panel)
   - Return URLs: the callback URL shown in the same panel
4. In Lovable Cloud → Users → Authentication Settings → Sign In Methods → Apple → enter the Services ID, Team ID, Key ID, and `.p8` contents. Click **Generate Secret**.

Once configured, the existing Google sign-in button in `src/pages/Auth.tsx` can be paired with an Apple button using:
```ts
import { lovable } from "@/integrations/lovable";
await lovable.auth.signInWithOAuth("apple", { redirect_uri: window.location.origin });
```
(Adding the visible button is a small UI follow-up — say the word and we'll drop it in.)

---

## 5. GitHub repo secrets (for the primary build pipeline)

Repository → Settings → Secrets and variables → Actions → New repository secret. Add:

| Secret | Value |
|---|---|
| `APPLE_ID` | your Apple Developer email |
| `APPLE_APP_SPECIFIC_PASSWORD` | https://account.apple.com → Sign-In and Security → App-Specific Passwords |
| `APPLE_TEAM_ID` | 10-char Team ID |
| `BUILD_CERTIFICATE_BASE64` | `base64 -i Certificates.p12` |
| `P12_PASSWORD` | password used when exporting the .p12 |
| `BUILD_PROVISION_PROFILE_BASE64` | `base64 -i Profile.mobileprovision` |
| `KEYCHAIN_PASSWORD` | any random string (used to create a temp keychain) |
| `GOOGLE_SERVICE_INFO_PLIST_BASE64` | `base64 -i GoogleService-Info.plist` |

> **Encoding tip (any OS):** Linux/macOS `base64 -i file | tr -d '\n' | pbcopy` · Windows PowerShell `[Convert]::ToBase64String([IO.File]::ReadAllBytes("file"))`.

---

## 6. Build and ship — GitHub Actions (PRIMARY)

1. Push to `main` (or run **Actions → iOS Build (App Store) → Run workflow**).
2. The workflow `.github/workflows/ios-build.yml`:
   - Installs deps, runs `npm run build`.
   - Strips the dev `server.url` from `capacitor.config.ts` (so the production app loads bundled assets, not the Lovable preview).
   - Runs `npx cap add ios` (first time) + `npx cap sync ios`.
   - Installs `GoogleService-Info.plist`.
   - Imports signing certs into a temporary keychain.
   - `xcodebuild archive` → `xcodebuild -exportArchive` → signed `.ipa`.
   - Uploads to **TestFlight** via `xcrun altool`.
3. Apple processes the build (15–30 min) → email when ready.
4. App Store Connect → TestFlight → invite internal testers → run on a real iPhone.

---

## 6b. Alternative — Codemagic

`codemagic.yaml` is included. Connect the repo at https://codemagic.io, add an App Store Connect API key under Teams → Integrations, then trigger the `ios-release` workflow. Codemagic handles signing automatically (no `.p12` juggling). 500 free macOS minutes/month.

---

## 7. TestFlight → public App Store

1. TestFlight tab → add the new build to **Internal Testing**. Up to 100 testers, no Apple review.
2. After internal validation, submit to **External Testing** (up to 10 000 testers, Apple does a lightweight Beta App Review, usually <24 h).
3. App Store tab → select build → fill remaining metadata → **Submit for Review**. First review typically 24–48 h, sometimes a few days.
4. Once **Ready for Sale**, the app appears in the App Store within ~1 h.

---

## 8. Verifications you asked for

| Item | Status |
|---|---|
| Firebase iOS configuration compatibility | ✅ Bundle ID `com.mypromovers.app` valid for FCM + APNs; `@capacitor/push-notifications` v6 uses FCM v1. |
| APNs payload support | ✅ Edge function now sends `apns.payload.aps` with `alert`/`sound`/`mutable-content`/`content-available`. |
| Foreground notification handling | ✅ `usePushNotifications` listens to `pushNotificationReceived` and shows a `sonner` toast on iOS. |
| Apple Sign In | ✅ Provider enabled in Lovable Cloud; portal steps documented above. |
| Universal Links readiness | ✅ App ID capability prepared. Push tap handler routes by `data.reference_type`. To activate, add `applinks:yourdomain` to Associated Domains and host `apple-app-site-association` on your domain. |
| App Store privacy manifest | ✅ `ios/App/App/PrivacyInfo.xcprivacy` created with required API reason codes (UserDefaults CA92.1, FileTimestamp C617.1, SystemBootTime 35F9.1, DiskSpace E174.1) and collected data types. |
| Capacitor iOS production config | ✅ CI strips `server.url` before archive. iOS section added: `scheme`, `contentInset`, `backgroundColor`. |
| Android implementation untouched | ✅ No Android files, DB triggers, or schema changes. |
| Push architecture untouched | ✅ Same generic `device_tokens` + DB trigger + edge function; iOS just adds a new `platform` value. |

---

## 9. Final manual checklist

**Apple Developer**
- [ ] Enroll ($99/yr)
- [ ] Create App ID `com.mypromovers.app` with Push Notifications + Sign In with Apple
- [ ] Generate APNs `.p8` key (save Key ID + Team ID)
- [ ] Generate Distribution cert (`.p12`) and App Store provisioning profile
- [ ] Create Services ID for Apple Sign In + configure return URL

**Firebase**
- [ ] Add iOS app with Bundle ID `com.mypromovers.app`
- [ ] Download `GoogleService-Info.plist`
- [ ] Upload APNs `.p8` to Firebase → Cloud Messaging

**App Store Connect**
- [ ] Create app record + note numeric Apple ID
- [ ] Complete App Privacy questionnaire
- [ ] Upload 1024×1024 icon, 6.7" screenshots, description, keywords
- [ ] Set privacy policy URL + support URL
- [ ] Add test mover account credentials for the review team

**GitHub (cloud build)**
- [ ] Add the 8 repository secrets listed in §5
- [ ] Run **Actions → iOS Build (App Store)** workflow
- [ ] Wait for TestFlight email, install on a real iPhone, verify the **Send Test Push** admin button delivers

**Lovable Cloud**
- [ ] Apple Sign In credentials entered (Services ID, Team ID, Key ID, `.p8`)
