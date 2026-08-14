ALTER TYPE public.day_off_status ADD VALUE IF NOT EXISTS 'alternative_proposed';

ALTER TABLE public.day_off_requests
  ADD COLUMN IF NOT EXISTS alt_start_date date,
  ADD COLUMN IF NOT EXISTS alt_end_date date,
  ADD COLUMN IF NOT EXISTS alt_proposed_by uuid,
  ADD COLUMN IF NOT EXISTS alt_proposed_at timestamptz,
  ADD COLUMN IF NOT EXISTS alt_note text,
  ADD COLUMN IF NOT EXISTS alt_response text,
  ADD COLUMN IF NOT EXISTS alt_decline_reason text,
  ADD COLUMN IF NOT EXISTS alt_responded_at timestamptz;

CREATE OR REPLACE FUNCTION public.respond_day_off_alternative(_request_id uuid, _accept boolean, _reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req public.day_off_requests%ROWTYPE;
BEGIN
  SELECT * INTO _req FROM public.day_off_requests WHERE id = _request_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;
  IF _req.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF _req.status <> 'alternative_proposed'::public.day_off_status THEN
    RAISE EXCEPTION 'No alternative dates awaiting your response';
  END IF;
  IF NOT _accept AND (_reason IS NULL OR btrim(_reason) = '') THEN
    RAISE EXCEPTION 'A reason is required when declining the alternative dates';
  END IF;

  UPDATE public.day_off_requests
  SET alt_response = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END,
      alt_decline_reason = CASE WHEN _accept THEN NULL ELSE btrim(_reason) END,
      alt_responded_at = now(),
      status = CASE WHEN _accept THEN 'approved'::public.day_off_status ELSE 'declined'::public.day_off_status END,
      start_date = CASE WHEN _accept THEN COALESCE(alt_start_date, start_date) ELSE start_date END,
      end_date = CASE WHEN _accept THEN COALESCE(alt_end_date, end_date) ELSE end_date END,
      decline_reason = CASE WHEN _accept THEN decline_reason
                            ELSE COALESCE(decline_reason, 'Mover declined the proposed alternative dates') END
  WHERE id = _request_id;

  RETURN jsonb_build_object('success', true, 'accepted', _accept);
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_day_off_alternative(uuid, boolean, text) TO authenticated;