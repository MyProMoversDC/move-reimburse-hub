-- Allow any authenticated user to list other users for chat recipient picker (no PII exposed)
CREATE OR REPLACE FUNCTION public.list_chat_users_for_picker(exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
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
  WHERE exclude_user_id IS NULL OR p.id <> exclude_user_id
  GROUP BY p.id, p.first_name, p.last_name
  ORDER BY p.first_name, p.last_name;
$$;

REVOKE ALL ON FUNCTION public.list_chat_users_for_picker(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_chat_users_for_picker(uuid) TO authenticated;