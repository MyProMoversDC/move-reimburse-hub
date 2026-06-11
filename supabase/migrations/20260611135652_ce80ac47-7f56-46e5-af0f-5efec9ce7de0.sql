
REVOKE EXECUTE ON FUNCTION public.apply_rating_event(uuid, text, integer, text, uuid, text, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.last_positive_manual_adjustment(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.last_positive_manual_adjustment(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rating_event(uuid, text, integer, text, uuid, text, uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.find_mover_id_by_name(_worker_name text)
RETURNS UUID
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id FROM public.profiles p
  WHERE _worker_name IS NOT NULL
    AND trim(coalesce(p.first_name,'') || ' ' || coalesce(p.last_name,'')) ILIKE trim(_worker_name)
  ORDER BY p.created_at LIMIT 1;
$$;
REVOKE EXECUTE ON FUNCTION public.find_mover_id_by_name(text) FROM PUBLIC;

ALTER TABLE public.customer_refunds ADD COLUMN IF NOT EXISTS at_fault_mover_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- performance_reports
CREATE OR REPLACE FUNCTION public.trg_perf_report_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_mover_id UUID;
BEGIN
  v_mover_id := public.find_mover_id_by_name(NEW.worker_name);
  IF v_mover_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    PERFORM public.apply_rating_event(v_mover_id, 'misconduct_filed', -5,
      'Misconduct report filed: ' || COALESCE(NEW.title, NEW.incident_category, ''),
      NEW.id, 'performance_reports', NEW.created_by);
  ELSIF TG_OP = 'UPDATE' AND OLD.reviewed_at IS NULL AND NEW.reviewed_at IS NOT NULL THEN
    PERFORM public.apply_rating_event(v_mover_id, 'misconduct_confirmed', -8,
      'Misconduct confirmed by admin: ' || COALESCE(NEW.title, NEW.incident_category, ''),
      NEW.id, 'performance_reports', NULL);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS perf_report_rating_aiu ON public.performance_reports;
CREATE TRIGGER perf_report_rating_aiu AFTER INSERT OR UPDATE ON public.performance_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_perf_report_rating();

-- violence_incidents
CREATE OR REPLACE FUNCTION public.trg_violence_incident_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mover_id IS NULL THEN RETURN NEW; END IF;
  IF (TG_OP = 'UPDATE' AND OLD.admin_actions IS NULL AND NEW.admin_actions IS NOT NULL)
     OR (TG_OP = 'INSERT' AND NEW.admin_actions IS NOT NULL) THEN
    PERFORM public.apply_rating_event(NEW.mover_id, 'violence_incident', -10,
      'Violence incident reviewed by admin', NEW.id, 'violence_incidents', NULL);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS violence_incident_rating_aiu ON public.violence_incidents;
CREATE TRIGGER violence_incident_rating_aiu AFTER INSERT OR UPDATE ON public.violence_incidents
  FOR EACH ROW EXECUTE FUNCTION public.trg_violence_incident_rating();

-- alcohol_test_reports
CREATE OR REPLACE FUNCTION public.trg_alcohol_test_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.worker_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' AND LOWER(COALESCE(NEW.final_result, '')) IN ('fail','failed','positive') THEN
    PERFORM public.apply_rating_event(NEW.worker_id, 'alcohol_test_failed', -4,
      'Failed alcohol test (' || NEW.final_result || ')', NEW.id, 'alcohol_test_reports', NEW.tester_id);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS alcohol_test_rating_ai ON public.alcohol_test_reports;
CREATE TRIGGER alcohol_test_rating_ai AFTER INSERT ON public.alcohol_test_reports
  FOR EACH ROW EXECUTE FUNCTION public.trg_alcohol_test_rating();

-- reimbursements (2nd appeal declined)
CREATE OR REPLACE FUNCTION public.trg_reimbursement_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mover_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'declined' AND COALESCE(NEW.appeal_count, 0) >= 2 THEN
    PERFORM public.apply_rating_event(NEW.mover_id, 'reimbursement_declined', -1,
      'Reimbursement #' || COALESCE(NEW.reimbursement_number, '') || ' declined after appeals',
      NEW.id, 'reimbursements', NULL);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS reimbursement_rating_au ON public.reimbursements;
CREATE TRIGGER reimbursement_rating_au AFTER UPDATE ON public.reimbursements
  FOR EACH ROW EXECUTE FUNCTION public.trg_reimbursement_rating();

-- review_bonuses (approved)
CREATE OR REPLACE FUNCTION public.trg_review_bonus_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mover_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.status IS DISTINCT FROM NEW.status AND NEW.status='approved' THEN
    PERFORM public.apply_rating_event(NEW.mover_id, 'review_bonus_approved', 2,
      'Review bonus approved (invoice ' || COALESCE(NEW.invoice_number,'') || ')',
      NEW.id, 'review_bonuses', NULL);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS review_bonus_rating_au ON public.review_bonuses;
CREATE TRIGGER review_bonus_rating_au AFTER UPDATE ON public.review_bonuses
  FOR EACH ROW EXECUTE FUNCTION public.trg_review_bonus_rating();

-- referral_requests (bonus eligible)
CREATE OR REPLACE FUNCTION public.trg_referral_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.referrer_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP='UPDATE' AND OLD.bonus_eligible_at IS NULL AND NEW.bonus_eligible_at IS NOT NULL THEN
    PERFORM public.apply_rating_event(NEW.referrer_id, 'referral_approved', 2,
      'Referral became bonus-eligible: ' || COALESCE(NEW.referred_name,''),
      NEW.id, 'referral_requests', NULL);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS referral_rating_au ON public.referral_requests;
CREATE TRIGGER referral_rating_au AFTER UPDATE ON public.referral_requests
  FOR EACH ROW EXECUTE FUNCTION public.trg_referral_rating();

-- customer_refunds (at_fault_mover_id)
CREATE OR REPLACE FUNCTION public.trg_customer_refund_rating()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (TG_OP='INSERT' AND NEW.at_fault_mover_id IS NOT NULL)
     OR (TG_OP='UPDATE' AND OLD.at_fault_mover_id IS DISTINCT FROM NEW.at_fault_mover_id AND NEW.at_fault_mover_id IS NOT NULL) THEN
    PERFORM public.apply_rating_event(NEW.at_fault_mover_id, 'customer_refund_fault', -3,
      'Customer refund attributed to mover: ' || COALESCE(NEW.customer_name,''),
      NEW.id, 'customer_refunds', NEW.reviewed_by);
  END IF;
  RETURN NEW;
END;$$;
DROP TRIGGER IF EXISTS customer_refund_rating_aiu ON public.customer_refunds;
CREATE TRIGGER customer_refund_rating_aiu AFTER INSERT OR UPDATE ON public.customer_refunds
  FOR EACH ROW EXECUTE FUNCTION public.trg_customer_refund_rating();
