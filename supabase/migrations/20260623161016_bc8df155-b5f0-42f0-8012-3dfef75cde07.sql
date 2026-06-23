
-- QR tokens table
CREATE TABLE public.mover_shift_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL CHECK (action IN ('in','out')),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX mover_shift_qr_tokens_active_action
  ON public.mover_shift_qr_tokens(action) WHERE is_active;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mover_shift_qr_tokens TO authenticated;
GRANT ALL ON public.mover_shift_qr_tokens TO service_role;

ALTER TABLE public.mover_shift_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage QR tokens"
  ON public.mover_shift_qr_tokens FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Seed two initial tokens
INSERT INTO public.mover_shift_qr_tokens (action) VALUES ('in'), ('out');

-- Redeem function for movers
CREATE OR REPLACE FUNCTION public.redeem_mover_shift_qr(_action text, _token uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_valid boolean;
  v_open_id uuid;
  v_new_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_authenticated');
  END IF;

  IF NOT public.has_role(v_uid, 'mover'::app_role) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_a_mover');
  END IF;

  IF _action NOT IN ('in','out') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'bad_action');
  END IF;

  SELECT TRUE INTO v_valid
  FROM public.mover_shift_qr_tokens
  WHERE action = _action AND token = _token AND is_active = true
  LIMIT 1;

  IF NOT COALESCE(v_valid, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'invalid_token');
  END IF;

  IF _action = 'in' THEN
    SELECT id INTO v_open_id
    FROM public.shift_clock_entries
    WHERE user_id = v_uid AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;

    IF v_open_id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'already_clocked_in', 'entry_id', v_open_id);
    END IF;

    INSERT INTO public.shift_clock_entries (user_id) VALUES (v_uid)
    RETURNING id INTO v_new_id;
    RETURN jsonb_build_object('ok', true, 'action', 'in', 'entry_id', v_new_id);
  ELSE
    SELECT id INTO v_open_id
    FROM public.shift_clock_entries
    WHERE user_id = v_uid AND clock_out IS NULL
    ORDER BY clock_in DESC LIMIT 1;

    IF v_open_id IS NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'not_clocked_in');
    END IF;

    UPDATE public.shift_clock_entries
      SET clock_out = now()
      WHERE id = v_open_id;
    RETURN jsonb_build_object('ok', true, 'action', 'out', 'entry_id', v_open_id);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_mover_shift_qr(text, uuid) TO authenticated;

-- Admin helper: rotate a token (deactivates old, creates new)
CREATE OR REPLACE FUNCTION public.rotate_mover_shift_qr(_action text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  IF _action NOT IN ('in','out') THEN
    RAISE EXCEPTION 'bad action';
  END IF;

  UPDATE public.mover_shift_qr_tokens
    SET is_active = false
    WHERE action = _action AND is_active = true;

  INSERT INTO public.mover_shift_qr_tokens (action, created_by)
  VALUES (_action, auth.uid())
  RETURNING token INTO v_new;

  RETURN v_new;
END;
$$;

GRANT EXECUTE ON FUNCTION public.rotate_mover_shift_qr(text) TO authenticated;

-- Admin: list currently active mover shifts
CREATE OR REPLACE FUNCTION public.admin_list_active_mover_shifts()
RETURNS TABLE(entry_id uuid, user_id uuid, first_name text, last_name text, clock_in timestamptz)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.user_id, p.first_name, p.last_name, e.clock_in
  FROM public.shift_clock_entries e
  JOIN public.profiles p ON p.id = e.user_id
  JOIN public.user_roles ur ON ur.user_id = e.user_id AND ur.role = 'mover'::app_role
  WHERE e.clock_out IS NULL
    AND public.has_role(auth.uid(), 'admin'::app_role)
  ORDER BY e.clock_in DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_active_mover_shifts() TO authenticated;

-- Admin: aggregated mover shift hours within a date range
CREATE OR REPLACE FUNCTION public.admin_list_mover_shift_entries(_start date, _end date, _mover_id uuid DEFAULT NULL)
RETURNS TABLE(entry_id uuid, user_id uuid, first_name text, last_name text, clock_in timestamptz, clock_out timestamptz, net_minutes integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    e.id,
    e.user_id,
    p.first_name,
    p.last_name,
    e.clock_in,
    e.clock_out,
    CASE
      WHEN e.clock_out IS NULL THEN NULL
      ELSE GREATEST(0, EXTRACT(EPOCH FROM (e.clock_out - e.clock_in))::int / 60)
    END AS net_minutes
  FROM public.shift_clock_entries e
  JOIN public.profiles p ON p.id = e.user_id
  JOIN public.user_roles ur ON ur.user_id = e.user_id AND ur.role = 'mover'::app_role
  WHERE public.has_role(auth.uid(), 'admin'::app_role)
    AND e.clock_in >= _start::timestamptz
    AND e.clock_in <  (_end + INTERVAL '1 day')
    AND (_mover_id IS NULL OR e.user_id = _mover_id)
  ORDER BY e.clock_in DESC;
$$;

GRANT EXECUTE ON FUNCTION public.admin_list_mover_shift_entries(date, date, uuid) TO authenticated;
