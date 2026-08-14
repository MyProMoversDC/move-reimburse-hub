ALTER TABLE public.day_off_requests
  ADD COLUMN IF NOT EXISTS alt_decline_reviewed_at timestamptz;

CREATE OR REPLACE FUNCTION public.notify_admins_on_day_off_alt_response()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.alt_response IS DISTINCT FROM OLD.alt_response AND NEW.alt_response IS NOT NULL THEN
    IF NEW.alt_response = 'declined' THEN
      PERFORM public.push_admins_on_submission(
        'Alternative dates declined',
        COALESCE(NEW.user_name, 'A mover') || ' declined the proposed alternative day off dates',
        jsonb_build_object('type', 'day_off_request', 'id', NEW.id::text)
      );
    ELSE
      PERFORM public.push_admins_on_submission(
        'Alternative dates accepted',
        COALESCE(NEW.user_name, 'A mover') || ' accepted the proposed alternative day off dates',
        jsonb_build_object('type', 'day_off_request', 'id', NEW.id::text)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_day_off_alt_response ON public.day_off_requests;
CREATE TRIGGER trg_notify_admins_day_off_alt_response
AFTER UPDATE ON public.day_off_requests
FOR EACH ROW
EXECUTE FUNCTION public.notify_admins_on_day_off_alt_response();