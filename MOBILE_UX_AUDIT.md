# Mobile UX/UI Audit — MyProMovers

Date: 2026-06-26
Viewport tested: 390 × 844 (iPhone 14-class), Playwright Chromium, mobile UA.
Roles walked: Admin, Operations Manager, Office Staff, HR Manager, Warehouse Keeper, Accountant, Customer Review Manager, Mover.

Scope: visual + UX only. No business logic, DB, RPC, edge function, auth, routing, Capacitor, native iOS/Android, Firebase, APNs or FCM was touched.

---

## 1. Screens reviewed

For every role I navigated dashboard landing → opened the slide-out drawer → at least one feature screen (list / form / dialog).

| Role | Landing screen | Drawer | Notes captured |
|---|---|---|---|
| Admin | Admin Dashboard (loading) | Full feature list | Top bar title clipped to "Das…" |
| Operations Manager | Performance Reports table | Full | Page H1 wraps to 3 lines next to action button |
| Office Staff | Feed | Full | Emoji glyphs render as boxes (font fallback) |
| HR Manager | Mobile-simplified user list | Full | Search input clipped on right edge |
| Warehouse Keeper | Warehouse Inventory | Full | Raw 6-col table on mobile, "+ Category" + "+ Item" wrap |
| Accountant | Confirmed Reimbursements | Full | Cards look good; H1 mono-styled |
| Customer Review Manager | Reviews list | Full | Top bar clipped, otherwise card layout works |
| Mover | Feed | Full | Cards look good |

Screenshots: `/tmp/browser/audit/before/*.png` (baseline) and `/tmp/browser/audit/after/*.png` (post-fix).

---

## 2. Global issues found

### Critical (fixed this turn)
1. **Top bar title truncated to 3–4 characters on every role.** Every dashboard passes its own Settings button + LanguageSelector into `rightActions`, both rendered at desktop size (`h-10`, full text). They consumed >55% of the 390 px bar, leaving the title with "War…", "Con…", "Perf…", "HR …".
2. **Switch Cabinet drawer footer expanded by default**, listing all 7 sibling roles + checkmark + 2 headers. It pushed Log out below the fold and ate ~45% of the drawer's vertical real estate.
3. **No font-family declared on `html/body`.** UAs fell back to the platform's serif/mono default for many headings; readability and brand consistency suffered. The shell's title looked monospaced on iOS WebView.

### High (logged, next pass)
4. **Duplicate page title.** Many screens render an in-card H1 that repeats the top-bar title (e.g. top bar "Warehouse" + card heading "Warehouse Inventory"). One H1 per screen is the rule.
5. **In-card heading wraps next to primary action.** "Performance / Misconduct Reports" wraps to 3 lines because the "Create New Report" button sits on the right at full desktop width. Same pattern in Warehouse Inventory ("+ Category" + "+ Item"), and Confirmed Reimbursements ("Export").
6. **Raw tables still leak through on mobile.**
   - Operations Manager → Performance/Misconduct Reports (4-col table, dates wrap to 3 lines)
   - Warehouse Keeper → Warehouse Inventory (6 cols, all clipped)
   - Some HR Manager sub-screens
7. **Emoji rendering** (Feed birthday posts) shows tofu boxes on the test Chromium build; on real iOS the system emoji will render correctly, but this is worth verifying on real Android.
8. **HR mobile user-list** search input overruns the card right edge.
9. **Heading typography is inconsistent across roles** — some pages still apply `font-mono` (Admin Alcohol Tests, Admin Mover Shifts, Shift Schedule timer) for data fields where it is intentional, but a handful of page-level H1s read as monospace because their components hard-set `text-2xl font-bold` with no font-family chain — to verify per-screen.

### Medium
10. **Right-action slot height inconsistent**: 40 px Settings vs 36 px LanguageSelector. Now normalized via shell CSS scope.
11. **No active press feedback** on the language dropdown trigger.
12. **Drawer width** (`85vw max 340px`) leaves a thin un-dismissable backdrop strip; acceptable on iOS but feels tight on 390 px.
13. **Sticky safe areas**: top bar `pt-safe` ✓; bottom bar `pb-safe` ✓; dialogs not all auditing for `pb-safe`.
14. **Status badges** vary in height (24 px on reimbursements, 20 px on feed). Tokenization needed.
15. **Card spacing** in `ResponsiveCardTable` is consistent, but per-screen consumers add their own padding leading to uneven gutters across roles.

---

## 3. Fixes applied this turn

All changes are presentation only — no logic, routing, or backend touched.

### `src/components/mobile/MobileShell.tsx`
- **Right-action slot compressed for the native bar.** Added a scoped CSS rule that forces any child button to `h-9 px-2 text-xs`, icons to `h-4 w-4`, and caps the slot width at `44vw` with `overflow-hidden`. Title now gets `flex-1 min-w-0`, so full page titles fit ("Performance Reports", "Warehouse", "Confirmed Reimburs…" with graceful ellipsis instead of "Per…").
- **Switch Cabinet collapsed by default.** The drawer footer now shows a single row:
  `[icon] Admin Portal …………… SWITCH ▼`
  Tapping toggles an inline list of the user's *other* roles only (current role hidden because it's the row title). Open/closed state persists per browser session in `sessionStorage` under `mobileShell.switchRole.expanded`. The block renders only when `availableRoles.length > 1`, matching the spec.
- **Log out flattened to a drawer row** (was an outlined button) so it visually matches the other nav items.
- **Signed-in name moved to a thin caption** under Log out — reclaims the prime drawer real estate for actual navigation.
- Removed unused `Button` and `Check` imports.

### `src/index.css`
- Added a native system font stack on `html, body` (`-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, "Helvetica Neue", system-ui, sans-serif`) plus `SF Pro Display` for headings, antialiasing, and a slight `letter-spacing: -0.01em` on H1–H6. Removes the serif/mono fallback that made some text look like a typewriter on iOS WebView.

### Verification
- Re-ran the full 8-role Playwright walk against `localhost:8080`. Before/after screenshots saved under `/tmp/browser/audit/{before,after}/`. Visible deltas:
  - Top-bar title visibility restored on **all 8 roles**.
  - Drawer Switch Cabinet condensed from ~9 rows to **1 row**.
  - Heading text now renders in the platform native sans.

---

## 4. Recommended next pass (visual, non-breaking)

These are per-screen polish items. They should be tackled one role at a time, each as a small PR, so we can compare before/after per surface.

### 4.1 Page header pattern
Replace the per-dashboard "in-card H1 + side-by-side primary action" with a shared `MobilePageHeader` primitive:
```
[Page title (only when different from top-bar)]   ← optional, hidden by default on mobile
[Description, 1 line, text-sm muted]
[Primary action — full-width Sheet trigger]
```
This kills duplicate titles (issue #4) and fixes wrap-around (#5).

### 4.2 Tables left on mobile
Convert these three to the existing `ResponsiveCardTable`:
- `AdminPerformanceReports` (Ops Manager view)
- `WarehouseInventoryManager`
- `WarehouseFleetTable` (purchases / parts)

### 4.3 Form polish (Reimbursement, Missing Payment, Violence Incident)
Standardize inputs to `h-11 text-base` (prevents iOS auto-zoom), labels `text-sm font-medium`, field gap `space-y-4`, validation `text-xs text-destructive`. Wire `StickySaveBar` with `pb-safe` for all multi-step forms.

### 4.4 Status badge tokenization
One `Badge` recipe: `h-5 px-2 rounded-full text-[11px] font-semibold uppercase tracking-wide`, variants only by color (`success/warning/destructive/secondary`). Replace the 4–5 ad-hoc badge styles currently in use.

### 4.5 Heading font sweep
Audit page-level `<h1>`/`<h2>` for any explicit `font-mono`, `font-serif` or hard-coded font-family. Keep `font-mono` only for numeric/data fields (BAC reading, clock-in time, hours) where it is intentional.

### 4.6 HR Manager full mobile
Currently a notice tells the user to switch to a tablet/desktop. A swipeable two-pane pattern (`Sheet` for detail) would make it usable one-handed.

### 4.7 Native press feedback
Apply `active:scale-[0.98] transition-transform` to all primary CTAs site-wide.

### 4.8 Safe areas on Dialogs
`ResponsiveDialog` should always set `pb-safe` and `max-h-[92dvh]` on the mobile Sheet variant.

---

## 5. Pre-release recommendations — Google Play & App Store

Before submitting to Play Store / App Store, run through this short checklist (visual / UX only — store metadata, privacy manifest, push entitlements are tracked separately in `IOS_SETUP.md`).

1. **Side-by-side device test on a real iPhone (14 / SE) and real Android (Pixel-class + low-end 360 px).** Simulators miss Dynamic Island and gesture-bar overlap; Playwright can't catch keyboard avoidance.
2. **Bottom-safe-area on every Sheet/Dialog.** Floating Save bars must not collide with the iOS home indicator or Android gesture pill.
3. **Tap-target audit** (Apple HIG 44 pt, Material 48 dp). The shell primitives already enforce this; per-screen icon buttons in Feed, Chat, and Crew Tracking still need a sweep.
4. **One-handed reachability** for primary actions on the Mover cabinet (Shift Clock, Arrived / Moving / Completed). All primary CTAs should sit within the lower 60% of the viewport.
5. **Empty states**: every list ("No items", "No reports yet") deserves an illustration + a primary action — currently plain text.
6. **Loading states**: replace "Loading…" plain text with skeletons matching the destination layout.
7. **Drawer entry animation** is the default 200 ms slide — feels right; verify reduced-motion respects user OS setting (`prefers-reduced-motion`).
8. **Localization**: with ES/RU labels, the drawer items and badges grow ~20%. Spot-check the longest strings ("Misconduct/Performance Submissions", "Customer Review Manager Portal") in ES.
9. **Dark mode parity**: the design tokens are wired but only the light theme was exercised in this audit. Walk all 8 roles in dark mode before release.
10. **App Store screenshots**: regenerate marketing screenshots after the next polish pass — the current per-role screens still show the old top-bar truncation in some captured assets.

---

## 6. Files changed

- `src/components/mobile/MobileShell.tsx` — collapsible Switch Cabinet, compressed right-action slot, drawer footer redesign, session-persisted role expand state.
- `src/index.css` — global native font stack on `html/body` + `h1–h6`.

No other files were modified.
