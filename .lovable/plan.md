## Mobile UX Pass 4 — Per-screen polish & remaining table conversions

With the global shell, typography, density, and centered max-width container now shipped, the next step is to clear the remaining High-priority items from `MOBILE_UX_AUDIT.md` so the app is release-ready on phones.

### 1. Convert remaining wide tables to mobile cards
These still render as horizontally-scrolling desktop tables on phones:
- `ShiftScheduleAdmin` (admin shift records)
- `AdminMoverShifts` "Live Now" + history tables
- `EmailLogs` inbound/outbound trail
- `JobOrdersManager` job list (desktop table stays; add `md:hidden` card list)
- `CrewsManager` crews & members table

Each gets a `md:hidden` card list (Title, key fields, status Badge, actions in a row) while the existing `<Table>` is preserved behind `hidden md:block`.

### 2. Badge & status tokenization sweep
Replace remaining hardcoded color chips (`bg-green-100 text-green-700`, etc.) in Ops/HR/Reviews/Accountant lists with the semantic `<Badge variant="...">` component so they theme correctly and read consistently on mobile.

### 3. Drawer & dialog polish
- Add `overscroll-contain` to `Sheet` body (drawer no longer rubber-bands the page underneath on iOS).
- Make `ResponsiveDialog` snap to bottom-sheet on phones with a drag handle for the dialogs that are still center-modals (Assign Movers, Assign Crew, Mover Live Track, Force Status).

### 4. Forms polish
- `MoverAutocomplete`, `SearchableSelect`: bump trigger to `h-11` and 16px on mobile to match the design-system update.
- Date pickers: ensure calendar popovers don't overflow the 640px container.

### 5. Empty states & loading skeletons
Standardize empty states (icon + one line + optional CTA) for Reimbursements history, Payment Questions, Feed, Job Orders, Shifts — currently several show raw "No data" text.

### 6. Audit verification
Re-run the Playwright mobile sweep across all 8 cabinets at 390×844 and append a Pass 4 section to `MOBILE_UX_AUDIT.md` with before/after screenshots and the final pre-release checklist (Dynamic Island, Android gesture nav, landscape).

### Out of scope
- No business logic / DB / RLS changes.
- Desktop layout untouched.
- No changes to Capacitor config, push notifications, or auth flows.

### Files expected to change
- `src/components/dashboard/shifts/ShiftScheduleAdmin.tsx`
- `src/components/dashboard/AdminMoverShifts.tsx`
- `src/components/dashboard/EmailLogs.tsx`
- `src/components/dashboard/inventory/JobOrdersManager.tsx`
- `src/components/dashboard/inventory/CrewsManager.tsx`
- `src/components/ui/sheet.tsx`, `src/components/ui/responsive-dialog.tsx`
- `src/components/MoverAutocomplete.tsx`, `src/components/SearchableSelect.tsx`
- `MOBILE_UX_AUDIT.md`
