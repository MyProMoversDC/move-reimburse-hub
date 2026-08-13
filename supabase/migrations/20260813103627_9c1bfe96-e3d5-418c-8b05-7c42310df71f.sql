CREATE OR REPLACE FUNCTION public.notify_admins_on_day_off_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.request_type = 'mover' AND NEW.status = 'pending' THEN
    PERFORM public.push_admins_on_submission(
      'New Day Off Request',
      COALESCE(NEW.user_name, 'A mover') || ' requested ' ||
        CASE WHEN NEW.start_date = NEW.end_date
          THEN NEW.start_date::text
          ELSE NEW.start_date::text || ' - ' || NEW.end_date::text
        END,
      jsonb_build_object('type', 'day_off_request', 'tab', 'day-off-requests', 'id', NEW.id::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_admins_day_off_request ON public.day_off_requests;
CREATE TRIGGER trg_notify_admins_day_off_request
AFTER INSERT ON public.day_off_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_admins_on_day_off_request();