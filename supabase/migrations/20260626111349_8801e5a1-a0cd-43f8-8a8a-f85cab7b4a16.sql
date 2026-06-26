
-- Make assign_movers_to_inv_job_order trigger a recompute so status flips to 'assigned'
CREATE OR REPLACE FUNCTION public.assign_movers_to_inv_job_order(_inv_job_id uuid, _user_ids uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_job RECORD;
  v_truck_number text;
  v_assignment_id uuid;
  v_inserted int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT (public.has_role(v_caller,'admin') OR public.has_role(v_caller,'operations_manager')) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF _user_ids IS NULL OR array_length(_user_ids,1) IS NULL THEN
    RAISE EXCEPTION 'At least one mover is required';
  END IF;

  SELECT j.id, j.job_number, j.client_name, j.job_date, j.pickup_address, j.dropoff_address, j.notes, j.truck_id
    INTO v_job
  FROM public.inv_job_orders j WHERE j.id = _inv_job_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Job order not found';
  END IF;

  SELECT truck_number INTO v_truck_number FROM public.trucks WHERE id = v_job.truck_id;

  INSERT INTO public.job_assignments (
    external_job_id, job_number, client_name, service_date,
    scope_of_work, truck_number, callback_url
  )
  VALUES (
    v_job.id, v_job.job_number, v_job.client_name, v_job.job_date,
    COALESCE(v_job.notes, ''), v_truck_number, NULL
  )
  ON CONFLICT (external_job_id) DO UPDATE
    SET job_number   = EXCLUDED.job_number,
        client_name  = EXCLUDED.client_name,
        service_date = EXCLUDED.service_date,
        scope_of_work= EXCLUDED.scope_of_work,
        truck_number = EXCLUDED.truck_number,
        updated_at   = now()
  RETURNING id INTO v_assignment_id;

  WITH new_rows AS (
    INSERT INTO public.mover_job_assignments (assignment_id, user_id, status)
    SELECT v_assignment_id, uid, 'pending'
    FROM unnest(_user_ids) AS uid
    ON CONFLICT (assignment_id, user_id) DO NOTHING
    RETURNING user_id
  )
  SELECT count(*)::int INTO v_inserted FROM new_rows;

  INSERT INTO public.mover_notifications (
    user_id, notification_type, reference_type, reference_id,
    title, message, is_read
  )
  SELECT
    uid, 'job_assignment', 'job_assignment', v_assignment_id,
    'New job assigned',
    'Job #' || v_job.job_number || ' for ' || v_job.client_name ||
      CASE WHEN v_job.job_date IS NOT NULL THEN ' on ' || to_char(v_job.job_date, 'YYYY-MM-DD') ELSE '' END ||
      '. Please review and Accept or Decline in My Jobs.',
    false
  FROM unnest(_user_ids) AS uid
  WHERE EXISTS (
    SELECT 1 FROM public.mover_job_assignments mja
    WHERE mja.assignment_id = v_assignment_id AND mja.user_id = uid AND mja.status = 'pending'
  );

  -- Recompute job status (likely pending -> assigned) and log a history event.
  PERFORM public.recompute_inv_job_status(_inv_job_id, v_caller, 'assign', 'ops_override');

  RETURN jsonb_build_object(
    'assignment_id', v_assignment_id,
    'newly_assigned', v_inserted
  );
END;
$function$;
