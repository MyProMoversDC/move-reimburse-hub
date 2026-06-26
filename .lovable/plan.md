## Problem

Today, `confirm-job` flips the `inv_job_orders` status to `in_progress` the moment ANY single mover taps "Moving to Site", and to `completed` only when ALL assigned movers mark themselves complete. With crews of 2–8 movers, this causes two issues:

1. **Premature "In Progress"** — one mover leaving the parking lot moves the whole job, even if the rest of the crew hasn't accepted or started.
2. **No status history** — we only store the latest `status` on `inv_job_orders`. Ops Manager can't see when/why a job transitioned, who triggered it, or replay the timeline.

## Recommended transition rules (the "when")

Use a **quorum + earliest-meaningful-action** model rather than "first mover wins" or "all movers required":

| Job status | Trigger |
|---|---|
| `assigned` | Ops Manager assigns movers (current behavior) |
| `confirmed` | ALL accepted movers have responded (no `pending` left) AND at least one accepted |
| `en_route` *(new)* | FIRST accepted mover taps "Moving to Site" |
| `in_progress` | At least 50% of accepted movers have tapped "Arrived at Site" (configurable threshold, default = majority; for solo jobs = that one mover) |
| `completed` | ALL accepted movers tapped "Completed" — OR Ops Manager force-closes |
| `cancelled` | Ops Manager cancels, or every mover declined |

Rationale:
- "Moving to Site" by one person ≠ job actually running — keep that visible as `en_route` so dispatch knows the crew is traveling but the clock hasn't started for billing/SLA purposes.
- "Arrived at Site" by the majority is the real start of work on the customer's property — best proxy for billable "In Progress".
- `completed` stays strict (all movers) so partial walk-offs don't auto-close a job; Ops Manager keeps a manual override.

Declined movers are excluded from the quorum so one decline doesn't block transitions.

## Status history (the "how to optimize")

Add an append-only `inv_job_status_events` table instead of inferring history from per-mover timestamps:

```text
inv_job_status_events
├─ id
├─ inv_job_id        → inv_job_orders.id
├─ from_status       (nullable, for first event)
├─ to_status
├─ triggered_by      → auth.users.id (mover or ops manager)
├─ trigger_source    ('mover_action' | 'ops_override' | 'system_quorum' | 'sync')
├─ mover_action      ('accept'|'arrived_parking'|'moving_to_site'|'arrived_site'|'completed'|null)
├─ quorum_snapshot   jsonb  (e.g. {"accepted":4,"arrived_site":3,"completed":0})
├─ note              text
└─ created_at        timestamptz
```

Benefits:
- Single source of truth for the timeline (used by Ops UI + audits + analytics).
- `quorum_snapshot` lets you re-explain WHY a status changed without recomputing from raw pings.
- Indexed by `(inv_job_id, created_at)` for fast timeline reads.
- Survives mover deletions (history doesn't disappear if a mover row is removed).

`inv_job_orders.status` stays as the cached "current" value for fast list queries; the events table is the journal.

## Changes required

**Database (1 migration)**
- New `inv_job_status_events` table + GRANTs + RLS (admin/ops_manager read; service_role write).
- Add `inv_job_orders.crew_quorum_threshold numeric` (default 0.5) so per-job overrides are possible later.
- Helper RPC `recompute_inv_job_status(_inv_job_id uuid)` — pure function called by edge functions; computes the correct status from `mover_job_assignments` and writes an event row if it changed.

**Edge function `confirm-job`**
- Replace the inline "first → in_progress / all → completed" logic with a single call to `recompute_inv_job_status` after every mover lifecycle update.
- Emit one event per real transition (no duplicates if status didn't change).

**Ops UI (`AssignMoversDialog.tsx`)**
- New "Status timeline" tab fed from `inv_job_status_events`: vertical list `assigned → confirmed → en_route → in_progress → completed` with EST timestamps, actor name, and quorum snapshot tooltip.
- Add "Force status" admin action that writes an `ops_override` event.

**Backward compatibility**
- Backfill: on migration, write a synthetic `assigned` event (`created_at = inv_job_orders.created_at`) and a current-status event for existing jobs so the timeline isn't empty.
- The new `en_route` status is additive — existing dashboards filtering by `in_progress` still work; add `en_route` to "active" filters where appropriate.

## Open questions before I build

1. Quorum for `in_progress`: **majority arrived at site** (recommended), or **first arrival**, or **all arrived**?
2. Should Ops Manager be able to force `in_progress` manually (e.g. when a mover forgets to tap)?
3. Do you want `en_route` as a distinct visible status, or keep only `assigned → in_progress → completed` and use the timeline tab to show the en-route moment?
