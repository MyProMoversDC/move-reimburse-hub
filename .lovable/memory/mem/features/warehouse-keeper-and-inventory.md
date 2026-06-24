---
name: Warehouse Keeper role
description: New warehouse_keeper role with Warehouse, Live Map, Fleet, Purchases, Reports cabinet. Fleet shared with Operations Manager.
type: feature
---
- Role enum value: `warehouse_keeper`. Role display name: "Warehouse Keeper".
- Cabinet (`WarehouseKeeperDashboard.tsx`) tabs: Warehouse, Live Map, Fleet, Purchases, Reports, Chat, Knowledge Base.
- Operations Manager cabinet adds tabs: Fleet, Job Orders, Planning, Crew Tracking, Crews.
- Fleet (`trucks`, `truck_inventory`) is fully editable by BOTH Operations Manager and Warehouse Keeper (and Admin).
- Purchases automatically increase the linked inventory item quantity on insert.
- Crews link to existing `profiles` (real movers) via `crew_members.user_id`.
- Crew Tracking uses Mapbox with `mover_location_pings` (movers insert self only; ops/warehouse/admin can read).
- Tables: inventory_categories, inventory_items, trucks, truck_inventory, job_types, job_type_requirements, inv_job_orders, purchases, daily_locks, inv_audit_logs, warehouse_zones, warehouse_zone_items, crews, crew_members, crew_assignments, planning_routes, planning_stops, mover_location_pings.
- SmartMoving sync edge functions NOT yet ported — need SMARTMOVING_API_KEY and SMARTMOVING_API_URL secrets first.
