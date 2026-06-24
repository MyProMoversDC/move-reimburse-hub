## Goal

Replace the current text-list `PlanningBoard` with a monthly **calendar view** for the Ops Manager (and Warehouse Keeper) that:

1. Pulls Booked-stage opportunities directly from SmartMoving into a staging table.
2. Lets the manager click a day → see jobs → open an **Assign Crew** dialog ported from MovePro Inventory Hub.
3. Reuses the existing `mover_job_assignments` accept/decline workflow that we built in the previous step (so movers still get push + in-app notifications and must Accept/Decline).

## Architectural mapping (Inventory Hub → this project)

| Inventory Hub | This project |
|---|---|
| `workers` table | `profiles` filtered to `mover` role |
| `truck_crew_assignments` + `truck_crew_workers` | existing `mover_job_assignments` (with accept/decline) |
| `shifts` + `shift_trucks` | not used — truck is stored directly on `inv_job_orders.truck_id` |
| `job_orders` (created on assign) | `inv_job_orders` (created on assign from a `planning_jobs` row) |
| `planning_jobs` (SmartMoving cache) | **new** `planning_jobs` table (Booked opportunities) |
| `crew_members.position` | `crew_members` (already exists) |
| `inventory_movements` + truck inventory load step | **skipped for now** — keep dialog focused on crew/truck/notes (warehouse load can be added later) |

## What gets built

### 1. Database migration
- New `planning_jobs` table: `smartmoving_id` (unique), `job_number`, `customer_name`, `status`, `job_type`, `branch_name`, `service_date`, `start_time`, `end_time`, `estimated_total`, `address`, `move_size`, `raw jsonb`, `synced_at`. RLS: admin + operations_manager + warehouse_keeper read; service_role write.
- New `planning_sync_runs` table: `status`, `fetched_count`, `upserted_count`, `started_at`, `finished_at`, `error`. Same RLS.
- Add `planned_from_smartmoving_id text` to `inv_job_orders` (nullable) so we know which planning_job an inv_job_order came from, and badge the calendar.

### 2. Edge function rewrite: `sync-smartmoving-jobs`
- Port the Inventory Hub version that pages through `/opportunities?Status=4` (Booked) for a date range, fetches full opportunity details (estimates, addresses, move size), and upserts into `planning_jobs` keyed by `smartmoving_id`. Records a row in `planning_sync_runs`.
- Replaces the current version that wrote into `inv_job_orders` directly.

### 3. New component: `PlanningCalendar.tsx` (replaces `PlanningBoard.tsx`)
- Monthly grid (Mon–Sun), prev/next month, "Today" button.
- "Refresh from SmartMoving" button → invokes `sync-smartmoving-jobs` for visible range, then reloads.
- Each day cell shows count of Booked jobs + colored dots (assigned vs unassigned).
- Click a day → side panel listing jobs for that day with: job#, customer, time, address, move size. Each has an **Assign Crew** button (or "Assigned" badge if already in `inv_job_orders`).

### 4. New component: `AssignCrewDialog.tsx` (ported & adapted)
- Inputs: Truck (from `trucks` where is_active), Crew template (from `crews`), Movers checklist (from `profiles` with mover role), Scope of work, Parking-lot time, Job-site time, Notes.
- Selecting a Crew template auto-fills movers from `crew_members`.
- On Save: 
  1. Create row in `inv_job_orders` (truck, job_number, customer, date, scope, planned_from_smartmoving_id).
  2. Call existing RPC `assign_movers_to_inv_job_order(inv_job_id, mover_ids[])` — this reuses the accept/decline + notification flow we already shipped.
- Movers get push + in-app notification → Accept/Decline in their Mover cabinet (unchanged).
- Status badges in the dialog (Pending / Accepted / Declined) via existing `list_inv_job_order_assignments` RPC, so the Ops Manager can re-open the dialog and see who confirmed.

### 5. Wire-up
- `OperationsManagerDashboard` and `WarehouseKeeperDashboard`: swap `<PlanningBoard />` → `<PlanningCalendar />`.
- Keep existing `JobOrdersManager` "Assign Movers" button intact (already shipped).

## Out of scope (will not change)
- Mover-side accept/decline UI (already exists).
- Push/email notifications (already wired through `trg_push_on_mover_notification`).
- Inventory-loading-onto-truck step from Inventory Hub — deferred; can add later if needed.
- `shifts`/`shift_trucks` concept from Inventory Hub — not introduced.

## File changes
- **New**: `supabase/migrations/<ts>_planning_calendar.sql`
- **New**: `src/components/dashboard/inventory/PlanningCalendar.tsx`
- **New**: `src/components/dashboard/inventory/AssignCrewDialog.tsx`
- **Rewrite**: `supabase/functions/sync-smartmoving-jobs/index.ts`
- **Edit**: `src/components/dashboard/OperationsManagerDashboard.tsx`, `WarehouseKeeperDashboard.tsx` (swap component).
- **Delete (after swap)**: `PlanningBoard.tsx`

Confirm and I'll build it.
