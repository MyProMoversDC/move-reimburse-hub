# Fix mover autopopulation in Assign Crew (Ops Manager → Movers)

## Problem
The Assign Crew dialog already renders the `MoverAutocomplete` component, but the movers list comes back empty, so typing a name shows no suggestions. The current loader uses an embedded PostgREST join:

```ts
supabase.from("profiles")
  .select("id, first_name, last_name, user_roles!inner(role)")
  .eq("user_roles.role", "mover")
```

This join is unreliable under the project's RLS (profiles policies don't always permit the implicit relation traversal), which is why `AssignMoversDialog` already works around it with a two-step fetch. The DB has 18 movers, confirming data exists.

## Fix
Update `src/components/dashboard/inventory/AssignCrewDialog.tsx` to load movers the same way `AssignMoversDialog` does:

1. Query `user_roles` for all `user_id` where `role = 'mover'`.
2. Query `profiles` with `.in('id', moverIds)` to get `id, first_name, last_name`.
3. Sort by full name and feed into the existing `MoverAutocomplete`.

No schema, RLS, or UX changes — autocomplete UI and crew-template selection stay exactly as they are. After this fix, typing in the Movers field will show matching movers from the project's DB.

## Files
- `src/components/dashboard/inventory/AssignCrewDialog.tsx` — replace the single embedded-join query inside the `useEffect` loader with the two-query pattern.
