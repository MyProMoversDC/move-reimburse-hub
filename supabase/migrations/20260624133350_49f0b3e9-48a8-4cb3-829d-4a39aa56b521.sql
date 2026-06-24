
ALTER TABLE public.mover_job_assignments
  ADD COLUMN IF NOT EXISTS moving_to_site_at timestamptz;

DROP FUNCTION IF EXISTS public.list_inv_job_order_assignments(uuid);

CREATE OR REPLACE FUNCTION public.list_inv_job_order_assignments(_inv_job_id uuid)
 RETURNS TABLE(assignment_id uuid, mover_id uuid, first_name text, last_name text,
   status text, responded_at timestamptz, decline_reason text,
   started_at timestamptz, ended_at timestamptz,
   arrived_parking_at timestamptz, moving_to_site_at timestamptz,
   arrived_site_at timestamptz, created_at timestamptz)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT mja.id, mja.user_id, p.first_name, p.last_name, mja.status,
    mja.responded_at, mja.decline_reason, mja.started_at, mja.ended_at,
    mja.arrived_parking_at, mja.moving_to_site_at, mja.arrived_site_at, mja.created_at
  FROM public.job_assignments ja
  JOIN public.mover_job_assignments mja ON mja.assignment_id = ja.id
  JOIN public.profiles p ON p.id = mja.user_id
  WHERE ja.external_job_id = _inv_job_id
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  ORDER BY p.first_name, p.last_name;
$$;
