## Problem

`Daniel@mypromoversdc.com` and `Uliana@mypromoversdc.com` don't appear in the New Chat recipient picker because both hold the `admin` role in addition to their operational roles (mover, office_staff, hr_manager, operations_manager).

The DB function `public.list_chat_users_for_picker` currently excludes **any** user who has `admin` or `accountant` in their role list, regardless of what other roles they hold.

## Fix

Update the exclusion so it only hides users whose **entire** role set is `admin` and/or `accountant` (i.e., pure back-office accounts). Any user with at least one operational role (`mover`, `office_staff`, `hr_manager`, `operations_manager`, `warehouse_keeper`, `reviews_admin`, etc.) will appear in the picker — even if they also happen to be admin or accountant.

### Migration

Replace the function body with:

```sql
CREATE OR REPLACE FUNCTION public.list_chat_users_for_picker(exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, last_name text, roles text[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    p.id,
    p.first_name,
    p.last_name,
    COALESCE(
      ARRAY_AGG(ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
      ARRAY[]::text[]
    ) AS roles
  FROM public.profiles p
  LEFT JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE (exclude_user_id IS NULL OR p.id <> exclude_user_id)
    -- Only exclude users whose ONLY roles are admin/accountant
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur3
      WHERE ur3.user_id = p.id
        AND ur3.role NOT IN ('admin'::app_role, 'accountant'::app_role)
    )
  GROUP BY p.id, p.first_name, p.last_name
  ORDER BY p.first_name, p.last_name;
$$;
```

Key change: swap the `NOT EXISTS (has admin/accountant)` filter for `EXISTS (has at least one non-admin/non-accountant role)`. Users with zero roles are also excluded, which matches current behavior for orphaned accounts.

## Scope

- Single DB migration. No frontend or business-logic changes.
- Signature, return columns, and security model unchanged — fully backward compatible with `NewChatDialog` / any other caller.

## Verification

1. Re-run the picker query for Daniel and Uliana — both should now be returned.
2. Confirm a hypothetical pure-admin account (only `admin` role) is still excluded.
3. Open "New Chat" in the app and confirm both users are searchable.
