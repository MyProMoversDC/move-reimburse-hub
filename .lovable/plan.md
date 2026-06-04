# Past Shifts Tracker in "My Schedule"

Add a new **Past Shifts** section inside the existing "My Schedule" tab of `ShiftSchedule.tsx` (used by the Office Staff cabinet and other roles). Users will pick a date range with the existing calendar UI and see every shift they actually worked in that period, plus a total hours summary.

## What the user will see

Inside the My Schedule tab, below the existing "Upcoming Shifts" list, a new card titled **Past Shifts**:

- Two date pickers: **Start Date** and **End Date** (popovers with auto-close on select, matching the pattern already used in the Earnings tab).
- A summary row: **Total Hours Worked: X.XX h** for the selected range.
- A list of past shifts grouped by day, each row showing:
  - Date (formatted in EST via `formatDateEST`)
  - Clock-in time → Clock-out time
  - Break minutes (if any)
  - Net hours worked for that entry
- Empty state when no entries fall in the range.
- Defaults: Start = first day of current month, End = today, so the user sees something immediately.

## Data source

Reuse the existing `shift_clock_entries` table (already queried by the Earnings tab in the same component) joined with `shift_breaks`. Only include entries where `clock_out is not null` and `clock_in` falls inside the selected range. No new tables, no migration, no RLS changes.

Per-entry net minutes = `differenceInMinutes(clock_out, clock_in) - sum(shift_breaks.duration_minutes)` — identical formula to `calculateEarnings`.

## Files modified

1. `src/components/dashboard/ShiftSchedule.tsx`
   - Add state: `pastStartDate`, `pastEndDate`, `pastEntries`, `pastTotalHours`, popover open flags.
   - Add `fetchPastShifts` callback + `useEffect` that runs when the range changes.
   - Render the new **Past Shifts** card inside `<TabsContent value="schedule">`, after the existing Upcoming Shifts block.
   - All times formatted in EST per project standard.

2. `src/lib/shiftTranslations.ts`
   - Add keys for EN / ES / RU: `pastShifts`, `noPastShifts`, `netHours`, `breakLabel` (reuse `totalHours`, `startDate`, `endDate`, `selectDateRange` which already exist).

## Out of scope

- No new admin view (admins already see all shift data via `AdminShiftManagement`).
- No CSV export — can be added later if requested.
- No changes to clock-in/out, day-off, or earnings flows.
- No backend/database/RLS changes.

## Estimated size

~80–110 lines added in `ShiftSchedule.tsx`, ~12 lines added across the 3 language blocks in `shiftTranslations.ts`. Two files total.
