
## Goal

Add a QR-code-based shift system to the **Mover cabinet** so movers clock in by scanning a Clock-In QR and clock out by scanning a Clock-Out QR. Admins can view, print, and download both QR codes and track all mover shift activity (active now, historical, hours by date range).

## How it works

```text
[Admin prints 2 QRs] ──► posted at the office
       │
       ▼
Clock-In QR  ─ scan ─► mover phone opens /mover/clock?action=in  ─► creates shift_clock_entries row
Clock-Out QR ─ scan ─► mover phone opens /mover/clock?action=out ─► sets clock_out on open entry
       │
       ▼
[Admin Mover Shifts tab]  ► Active now • Calendar filter • Total hours per mover • CSV export
```

QR codes encode signed URLs containing the action and a rotating short token (stored as a secret/admin config). On scan: if the user is logged in as a mover, the action runs immediately; otherwise they land on the login page and the action runs after sign-in.

## Database (migration)

Reuse existing `shift_clock_entries` and `shift_breaks` tables (already in schema). Add:

- New table `mover_shift_qr_tokens` — stores the two active tokens (`action`: `'in' | 'out'`, `token`, `created_by`, `created_at`, `is_active`). RLS: admins manage; authenticated movers can call a SECURITY DEFINER function `redeem_mover_shift_qr(token, action)` that validates the token and inserts/updates `shift_clock_entries` for `auth.uid()`.
- RLS update on `shift_clock_entries`: allow movers to view their own rows; allow admins to view all (already partially present — verify and extend if missing).
- SECURITY DEFINER helper `admin_list_mover_shifts(start_date, end_date, mover_id?)` returning aggregated rows for the admin dashboard.

## Mover cabinet changes

New page/component `MoverShiftClock.tsx` added to `MoverDashboard` sidebar as **"Shift Clock"**:
- Big "Scan Clock-In QR" / "Scan Clock-Out QR" buttons using `@capacitor-community/barcode-scanner` on native and `html5-qrcode` web fallback.
- Shows current status (Clocked In since HH:mm / Not on shift), today's worked time, last 30 days history.

New public route `/mover/clock` that:
- Reads `?action=in|out&token=…` from URL.
- If not logged in → redirects to `/auth` then back.
- Calls `redeem_mover_shift_qr` RPC and shows success/failure toast.

## Admin cabinet changes

New tab inside `AdminShiftManagement.tsx` (or new component `AdminMoverShifts.tsx` mounted in admin sidebar) called **"Mover Shifts (QR)"**:

1. **QR Codes panel**
   - Renders both QR codes (Clock-In green, Clock-Out red) using existing `qrcode` package (already used in `AnonymousFeedbackQRCode.tsx`).
   - Buttons: Download PNG (each), Print (window.print with print stylesheet), Regenerate token (invalidates old QR — confirmation dialog).

2. **Active Now**
   - Live list of movers currently clocked in (entries with `clock_out IS NULL`), elapsed time, last scan time.

3. **History / Reporting**
   - Calendar date-range filter, optional mover filter (SearchableSelect, movers only).
   - Table: Mover • Date • Clock In • Clock Out • Net hours.
   - Footer totals: total hours per mover, grand total.
   - Export to Excel (reuse `src/lib/exportToExcel.ts`).

## Technical details

- Packages to add: `html5-qrcode` (web QR scanner). Capacitor barcode plugin is optional and only used when `Capacitor.isNativePlatform()` — graceful fallback to camera-based web scan.
- QR payload format: `${window.location.origin}/mover/clock?action=in&token=<uuid>`.
- Tokens are rotated only on admin demand; printed QRs remain valid until regenerated.
- All clock times stored UTC, displayed via existing `formatInEST` (EST rule from project memory).
- Mover role check: gated by `has_role(auth.uid(), 'mover')` in the RPC; admins blocked from clocking via QR.
- No changes to existing office-staff shift flow (`AdminShiftManagement` keeps its current scope).
- Add red-dot indicator in admin sidebar when ≥1 mover is currently clocked in (optional, per memory pattern).

## Files

**New**
- `supabase/migrations/<ts>_mover_shift_qr.sql`
- `src/components/dashboard/MoverShiftClock.tsx`
- `src/components/dashboard/AdminMoverShifts.tsx`
- `src/pages/MoverClockRedeem.tsx` (route `/mover/clock`)
- `src/lib/qrScanner.ts` (thin wrapper around html5-qrcode + Capacitor)

**Edited**
- `src/App.tsx` — add `/mover/clock` route
- `src/components/dashboard/MoverSidebar.tsx` + `MoverDashboard.tsx` — add Shift Clock entry
- `src/components/dashboard/AdminSidebar.tsx` + `AdminDashboard.tsx` — add Mover Shifts entry
- `package.json` — add `html5-qrcode`

## Open question

Do you want a **single QR per action that all movers share** (simpler — print once, post at office), or **per-mover QR codes** (more secure, individual accountability, admin prints a sheet)? Plan above assumes the **shared two-QR** model — confirm or I'll switch to per-mover.
