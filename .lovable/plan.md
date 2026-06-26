Based on the Mobile UX Audit Report (`MOBILE_UX_AUDIT.md`), the global shell, font stack, and collapsible Switch Cabinet are done. The next pass focuses on the remaining per-screen polish issues flagged as High priority so the app feels fully native on phones before release.

## Scope (mobile only, ≤430px width — desktop untouched)

### 1. Remove duplicate page headers
Several dashboards render an in-page H1/title that duplicates the sticky top bar title.
- `OperationsManagerDashboard.tsx`
- `WarehouseKeeperDashboard.tsx`
- `HRManagerDashboard.tsx`
- `AccountantDashboard.tsx`
- `CustomerReviewManagerDashboard.tsx`
Hide the in-page header on touch shells (`useTouchShell()` → `hidden`), keep it on desktop.

### 2. Convert remaining desktop tables to mobile cards
Wrap each table in `<div className="hidden md:block">` and add a `<div className="md:hidden">` card list using the existing `ResponsiveCardTable` primitive.
Targets identified in the audit:
- Ops Manager: `JobOrdersManager.tsx`, `FleetManager.tsx`, `CrewsManager.tsx`
- Warehouse Keeper: `WarehouseInventory.tsx`, `PurchasesManager.tsx`, `ReportsView.tsx`
- HR Manager: employee directory table
- Accountant: reimbursements payout table

### 3. Forms & inputs
- Force `text-base` (16px) on all `<Input>`/`<Textarea>` on mobile to prevent iOS zoom-on-focus.
- Make HR Manager search input full-width with `min-w-0` so it stops clipping at the right edge.
- Ensure every dialog opened on mobile uses `ResponsiveDialog` (sheet from bottom) — audit `AssignMoversDialog`, `AssignCrewDialog`, `MoverLiveTrackDialog`, `FleetManager` edit dialog.

### 4. Badge & status chip tokenization
Replace ad-hoc `bg-green-500`/`bg-red-500` chips across job-order, shift, and assignment views with semantic variants of `<Badge>` so dark mode and brand theming work consistently.

### 5. Safe-area & scroll polish
- Add `pb-safe` to the bottom of every primary scroll container so the last row clears the iOS home indicator.
- Add `overscroll-contain` to drawer and dialog bodies to stop rubber-band bleed.
- Confirm the sticky top bar keeps `pt-safe` after the recent changes (spot-check on Dynamic Island viewport).

### 6. Verification
Drive Playwright at 390×844:
- One screenshot per role dashboard after fixes.
- One screenshot of each converted table view (before/after side-by-side in the report).
- Open one dialog per role and confirm it slides up as a sheet.
Append results to `MOBILE_UX_AUDIT.md` under a new "Pass 2" section and mark items complete.

## Out of scope
- Any desktop layout changes.
- Business logic, RLS, edge functions, schema.
- Native Capacitor config, push notifications, build pipelines.

## Technical notes
- Gate all mobile-only branches on `useTouchShell()` or Tailwind `md:` breakpoints — never on user agent.
- Reuse existing primitives (`ResponsiveDialog`, `ResponsiveCardTable`, `MobileHeader`, `PullToRefresh`); do not introduce new ones.
- No new dependencies.
