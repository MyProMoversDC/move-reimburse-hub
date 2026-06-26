CREATE OR REPLACE FUNCTION public.trg_review_bonus_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.mover_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'confirmed'::review_bonus_status THEN
    PERFORM public.apply_rating_event(
      NEW.mover_id, 'review_bonus_approved', 2,
      'Review bonus approved (invoice ' || COALESCE(NEW.invoice_number,'') || ')',
      NEW.id, 'review_bonuses', NULL);
  END IF;
  RETURN NEW;
END;
$function$;