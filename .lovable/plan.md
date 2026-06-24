
# Plan: Port MovePro Inventory Hub features + add Warehouse Keeper role

## Scope

- **Operations Manager** gains: Fleet, Job Orders, Planning, Crew Tracking, Crews.
- **New role `warehouse_keeper`** gains: Warehouse, Warehouse Live Map, Purchases, Reports, Fleet.
- **Fleet** is shared (full CRUD for both roles).
- Existing Android, push notifications, movers cabinet, and current schema are untouched. All inventory tables are **net-new additions** — nothing in the current schema is altered.

## Architecture decisions (from your answers)

1. Schema is ported into THIS project's Supabase (no cross-project API).
2. Crews link to existing `profiles` (real movers), not standalone people.
3. Both roles get full CRUD on Fleet.
4. SmartMoving + Mapbox + location-ingest edge functions are ported.

## Step 1 — Database migration (one migration, additive only)

New `app_role` enum value: `warehouse_keeper`.

New tables (all under `public`, all with `GRANT … TO authenticated` + `service_role`, RLS enabled, policies use existing `has_role()`):

| Table | Purpose | Write access |
|---|---|---|
| `inventory_categories` | warehouse item categories | warehouse_keeper, admin |
| `inventory_items` | stock catalog (name, uom, qty, min_stock) | warehouse_keeper, admin |
| `trucks` | fleet vehicles | warehouse_keeper, operations_manager, admin |
| `truck_inventory` | per-truck stock | warehouse_keeper, operations_manager, admin |
| `job_types` + `job_type_requirements` | templates | operations_manager, admin |
| `inv_job_orders` | job orders (renamed to avoid collision with existing `job_assignments`) | operations_manager, admin |
| `purchases` | restock log | warehouse_keeper, admin |
| `daily_locks` | end-of-day inventory lock | warehouse_keeper, admin |
| `inv_audit_logs` | inventory audit trail | system insert; admin read |
| `warehouse_zones` | warehouse-map zones | warehouse_keeper, admin |
| `warehouse_zone_items` | items per zone | warehouse_keeper, admin |
| `crews` | named crew (date, lead) | operations_manager, admin |
| `crew_members` (`user_id → profiles.id`) | crew↔mover link | operations_manager, admin |
| `crew_assignments` (`crew_id`, `inv_job_order_id`) | crew↔job link | operations_manager, admin |
| `planning_routes` + `planning_stops` | optimized routes | operations_manager, admin |
| `mover_location_pings` | live GPS for crew tracking | mover insert self; ops_manager/warehouse_keeper/admin read |

Read access: `operations_manager` and `warehouse_keeper` can read all of the above (so Fleet works on both sides; Ops can see warehouse stock when building job orders).

Reuse existing `has_role()` (already present, no need to recreate).

> Note: this is purely **additive**. No existing column or policy is modified, so the current Mover / Admin / HR / Accountant / etc. cabinets are unaffected.

## Step 2 — Edge functions (port from source project)

Copy and adapt to this project's auth + secrets:

- `sync-smartmoving-jobs`, `sync-workers`, `fetch-smartmoving-crew-notes`
- `optimize-routes`
- `receive-mover-location`, `report-job-confirmation`, `notify-job-assignment`
- Reuse existing `get-mapbox-token` (already deployed here).

Required secrets to add (via `add_secret` when ready): `SMARTMOVING_API_KEY`, `SMARTMOVING_API_URL`, plus any SmartMoving webhook secret.

## Step 3 — Role & permission wiring

- Add `warehouse_keeper` to `availableRoles` and `roleDisplayNames` in `src/components/dashboard/UserRoleManager.tsx`.
- Add `warehouse_keeper` to the priority ladder in `src/pages/Dashboard.tsx` and render a new `WarehouseKeeperDashboard`.
- Add `warehouse_keeper` to the `UserRole` union type.

## Step 4 — New cabinet: Warehouse Keeper

New file `src/components/dashboard/WarehouseKeeperDashboard.tsx` following the existing sidebar+content pattern (mirrors `OperationsManagerDashboard.tsx` structure for visual consistency, logo always present, EN/ES/RU support, EST timestamps).

Tabs: **Warehouse**, **Live Map**, **Fleet**, **Purchases**, **Reports**, **Chat**, **Settings**.

## Step 5 — Operations Manager cabinet additions

Edit `src/components/dashboard/OperationsManagerDashboard.tsx` to add tabs: **Fleet**, **Job Orders**, **Planning**, **Crew Tracking**, **Crews** — appended after existing tabs so current behavior is preserved.

## Step 6 — Feature components (ported from source, adapted to shadcn/Tailwind tokens already used here)

New folder `src/components/dashboard/inventory/`:

- `FleetManager.tsx` (shared by both cabinets)
- `JobOrdersManager.tsx`
- `PlanningBoard.tsx` + `RouteSuggestionDialog.tsx`
- `CrewTrackingMap.tsx` (uses `useMapboxToken` + `mover_location_pings`)
- `CrewsManager.tsx` + `AssignCrewDialog.tsx` (uses `SearchableSelect` filtered to movers — per existing project rule)
- `WarehouseManager.tsx` (items, categories, daily-lock)
- `WarehouseLiveMap.tsx` + `WarehouseCanvas.tsx` + `ZoneEditorDialog.tsx` + `ZoneDetailsDrawer.tsx` + `ZoneItemsList.tsx` + `AnalyticsWidgets.tsx`
- `PurchasesManager.tsx`
- `ReportsDashboard.tsx`

All UI follows project standards already in memory: SearchableSelect for user pickers (admins/accountants filtered out for mover lists), transparent file-input overlay for uploads, calendars auto-close, "Approved" terminology, removable file uploads, EST timestamps, multilingual EN/ES/RU.

## Step 7 — Mobile parity

Add the new tabs to the mobile horizontal nav in both dashboards (same pattern used for "Shift Clock" addition).

## Step 8 — Verification

- Build passes.
- Existing Mover / Admin / Accountant / HR / Reviews / Office cabinets render unchanged.
- New roles' RLS policies tested via SQL: an `operations_manager` user cannot write to `purchases`; a `warehouse_keeper` cannot write to `inv_job_orders`; both can read/write `trucks` and `truck_inventory`.
- Live map shows pings only to allowed roles.

## Open items handled at build time (will request from you in build mode)

- SmartMoving API credentials (added via `add_secret` only when you confirm you want to enable sync).
- Optional: copy any seed data (job types, categories) from source project via CSV.

## Out of scope (explicit)

- No changes to: Android, push notification architecture, existing tables, existing edge functions, mover compliance flows, Checkr, handbook, consent, chat, feed, shift clock.
- No deletion of any feature.
- No iOS workflow changes (already shipped in earlier turns).

## Rough effort

~1 large DB migration, ~7 edge functions ported, ~12 new React components, 2 dashboards edited, 1 dashboard created, ~3 small wiring edits. Single build mode session can deliver it in 2–3 batches.
