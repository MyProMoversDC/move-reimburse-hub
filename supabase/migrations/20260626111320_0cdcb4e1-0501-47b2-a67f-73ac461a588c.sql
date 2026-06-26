
-- 1. Status events journal
CREATE TABLE public.inv_job_status_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  inv_job_id uuid NOT NULL REFERENCES public.inv_job_orders(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  triggered_by uuid,
  trigger_source text NOT NULL CHECK (trigger_source IN ('mover_action','ops_override','system_quorum','sync','backfill')),
  mover_action text,
  quorum_snapshot jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX inv_job_status_events_job_idx ON public.inv_job_status_events(inv_job_id, created_at);

GRANT SELECT ON public.inv_job_status_events TO authenticated;
GRANT ALL ON public.inv_job_status_events TO service_role;

ALTER TABLE public.inv_job_status_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and ops can read job status events"
  ON public.inv_job_status_events FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'operations_manager'::app_role));

CREATE POLICY "Service role manages job status events"
  ON public.inv_job_status_events FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 2. Quorum threshold column
ALTER TABLE public.inv_job_orders
  ADD COLUMN IF NOT EXISTS crew_quorum_threshold numeric NOT NULL DEFAULT 0.5;

-- 3. Recompute function: pure derivation from mover_job_assignments
CREATE OR REPLACE FUNCTION public.recompute_inv_job_status(
  _inv_job_id uuid,
  _triggered_by uuid DEFAULT NULL,
  _mover_action text DEFAULT NULL,
  _trigger_source text DEFAULT 'mover_action'
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignment_id uuid;
  v_current text;
  v_threshold numeric;
  v_total int;
  v_pending int;
  v_accepted int;
  v_declined int;
  v_arrived_parking int;
  v_moving int;
  v_arrived_site int;
  v_completed int;
  v_new text;
  v_snapshot jsonb;
BEGIN
  SELECT status, COALESCE(crew_quorum_threshold, 0.5)
    INTO v_current, v_threshold
    FROM public.inv_job_orders
    WHERE id = _inv_job_id;
  IF NOT FOUND THEN RETURN NULL; END IF;

  -- Find the bridge assignment for this job (may be null if no movers assigned yet)
  SELECT id INTO v_assignment_id
    FROM public.job_assignments
    WHERE external_job_id = _inv_job_id
    LIMIT 1;

  IF v_assignment_id IS NULL THEN
    RETURN v_current;
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status NOT IN ('pending','declined')),
    COUNT(*) FILTER (WHERE status = 'declined'),
    COUNT(*) FILTER (WHERE arrived_parking_at IS NOT NULL AND status <> 'declined'),
    COUNT(*) FILTER (WHERE moving_to_site_at IS NOT NULL AND status <> 'declined'),
    COUNT(*) FILTER (WHERE arrived_site_at IS NOT NULL AND status <> 'declined'),
    COUNT(*) FILTER (WHERE status = 'completed')
  INTO v_total, v_pending, v_accepted, v_declined, v_arrived_parking, v_moving, v_arrived_site, v_completed
  FROM public.mover_job_assignments
  WHERE assignment_id = v_assignment_id;

  v_snapshot := jsonb_build_object(
    'total', v_total, 'pending', v_pending, 'accepted', v_accepted, 'declined', v_declined,
    'arrived_parking', v_arrived_parking, 'moving_to_site', v_moving,
    'arrived_site', v_arrived_site, 'completed', v_completed,
    'threshold', v_threshold
  );

  -- Derive new status (do not regress past completed/cancelled)
  IF v_current IN ('completed','cancelled') THEN
    v_new := v_current;
  ELSIF v_total = 0 THEN
    v_new := 'pending';
  ELSIF v_accepted > 0 AND v_completed = v_accepted THEN
    v_new := 'completed';
  ELSIF v_accepted > 0 AND v_arrived_site::numeric / v_accepted::numeric >= v_threshold THEN
    v_new := 'in_progress';
  ELSIF v_moving > 0 THEN
    v_new := 'en_route';
  ELSIF v_accepted > 0 AND v_pending = 0 THEN
    v_new := 'confirmed';
  ELSIF v_total > 0 THEN
    v_new := 'assigned';
  ELSE
    v_new := v_current;
  END IF;

  IF v_new IS DISTINCT FROM v_current THEN
    UPDATE public.inv_job_orders
      SET status = v_new, updated_at = now()
      WHERE id = _inv_job_id;

    INSERT INTO public.inv_job_status_events
      (inv_job_id, from_status, to_status, triggered_by, trigger_source, mover_action, quorum_snapshot)
    VALUES
      (_inv_job_id, v_current, v_new, _triggered_by, _trigger_source, _mover_action, v_snapshot);
  END IF;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.recompute_inv_job_status(uuid, uuid, text, text) TO authenticated, service_role;

-- 4. Ops override function
CREATE OR REPLACE FUNCTION public.ops_set_inv_job_status(
  _inv_job_id uuid,
  _new_status text,
  _note text DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_current text;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.has_role(v_caller,'admin'::app_role) OR public.has_role(v_caller,'operations_manager'::app_role)) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _new_status NOT IN ('pending','assigned','confirmed','en_route','in_progress','completed','cancelled') THEN
    RAISE EXCEPTION 'Invalid status %', _new_status;
  END IF;

  SELECT status INTO v_current FROM public.inv_job_orders WHERE id = _inv_job_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Job not found'; END IF;

  IF v_current IS DISTINCT FROM _new_status THEN
    UPDATE public.inv_job_orders SET status = _new_status, updated_at = now() WHERE id = _inv_job_id;
    INSERT INTO public.inv_job_status_events
      (inv_job_id, from_status, to_status, triggered_by, trigger_source, note)
    VALUES
      (_inv_job_id, v_current, _new_status, v_caller, 'ops_override', _note);
  END IF;
  RETURN _new_status;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ops_set_inv_job_status(uuid, text, text) TO authenticated;

-- 5. List timeline (admin/ops only) with actor names
CREATE OR REPLACE FUNCTION public.list_inv_job_status_events(_inv_job_id uuid)
RETURNS TABLE (
  id uuid,
  from_status text,
  to_status text,
  trigger_source text,
  mover_action text,
  quorum_snapshot jsonb,
  note text,
  created_at timestamptz,
  actor_first_name text,
  actor_last_name text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.from_status, e.to_status, e.trigger_source, e.mover_action, e.quorum_snapshot, e.note, e.created_at,
         p.first_name, p.last_name
  FROM public.inv_job_status_events e
  LEFT JOIN public.profiles p ON p.id = e.triggered_by
  WHERE e.inv_job_id = _inv_job_id
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'operations_manager'::app_role))
  ORDER BY e.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_inv_job_status_events(uuid) TO authenticated;

-- 6. Backfill: synthetic "assigned" + current-status event for existing jobs
INSERT INTO public.inv_job_status_events (inv_job_id, from_status, to_status, trigger_source, created_at)
SELECT j.id, NULL, 'pending', 'backfill', j.created_at
FROM public.inv_job_orders j
WHERE NOT EXISTS (SELECT 1 FROM public.inv_job_status_events e WHERE e.inv_job_id = j.id);

INSERT INTO public.inv_job_status_events (inv_job_id, from_status, to_status, trigger_source, created_at)
SELECT j.id, 'pending', j.status, 'backfill', COALESCE(j.updated_at, j.created_at)
FROM public.inv_job_orders j
WHERE j.status IS NOT NULL AND j.status <> 'pending'
  AND NOT EXISTS (
    SELECT 1 FROM public.inv_job_status_events e
    WHERE e.inv_job_id = j.id AND e.to_status = j.status AND e.trigger_source = 'backfill'
  );
