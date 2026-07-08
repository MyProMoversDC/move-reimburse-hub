
-- Shared helper: pushes to every admin, isolating per-admin failures
CREATE OR REPLACE FUNCTION public.push_admins_on_submission(
  _title text,
  _body text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://qunbwlsgjrhayeqhgyce.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'title', _title,
          'body', _body,
          'data', _data,
          'source', 'admin_submission_alert'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_admins_on_submission failed for admin %: % (%)', r.user_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;

-- Small helper: resolve display name from profiles
CREATE OR REPLACE FUNCTION public._admin_push_name(_id uuid, _fallback text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE((SELECT first_name FROM public.profiles WHERE id = _id),'') || ' ' ||
                COALESCE((SELECT last_name  FROM public.profiles WHERE id = _id),'')), ''),
    NULLIF(_fallback,''),
    'Someone'
  );
$$;

-- =========================
-- Reimbursements
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_reimbursement_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Reimbursement Submitted',
    public._admin_push_name(NEW.mover_id, NULL) || ' submitted reimbursement #' || COALESCE(NEW.reimbursement_number,''),
    jsonb_build_object('reference_type','reimbursement','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_reimbursement_insert ON public.reimbursements;
CREATE TRIGGER admin_push_on_reimbursement_insert
AFTER INSERT ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_reimbursement_insert();

CREATE OR REPLACE FUNCTION public.trg_admin_push_reimbursement_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'Reimbursement Appeal Filed',
    public._admin_push_name(NEW.mover_id, NULL) || ' appealed reimbursement #' || COALESCE(NEW.reimbursement_number,''),
    jsonb_build_object('reference_type','reimbursement','reference_id',NEW.id,'notification_type','admin_appeal_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_reimbursement_appeal ON public.reimbursements;
CREATE TRIGGER admin_push_on_reimbursement_appeal
AFTER UPDATE ON public.reimbursements
FOR EACH ROW
WHEN (COALESCE(NEW.appeal_count,0) > COALESCE(OLD.appeal_count,0))
EXECUTE FUNCTION public.trg_admin_push_reimbursement_appeal();

-- =========================
-- Review bonuses
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_review_bonus_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Review Bonus Submitted',
    public._admin_push_name(NEW.mover_id, NULL) || ' submitted review bonus' ||
      CASE WHEN NEW.invoice_number IS NOT NULL THEN ' (invoice ' || NEW.invoice_number || ')' ELSE '' END,
    jsonb_build_object('reference_type','review_bonus','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_review_bonus_insert ON public.review_bonuses;
CREATE TRIGGER admin_push_on_review_bonus_insert
AFTER INSERT ON public.review_bonuses
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_review_bonus_insert();

CREATE OR REPLACE FUNCTION public.trg_admin_push_review_bonus_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'Review Bonus Appeal Filed',
    public._admin_push_name(NEW.mover_id, NULL) || ' appealed a review bonus',
    jsonb_build_object('reference_type','review_bonus','reference_id',NEW.id,'notification_type','admin_appeal_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_review_bonus_appeal ON public.review_bonuses;
CREATE TRIGGER admin_push_on_review_bonus_appeal
AFTER UPDATE ON public.review_bonuses
FOR EACH ROW
WHEN (COALESCE(NEW.appeal_count,0) > COALESCE(OLD.appeal_count,0))
EXECUTE FUNCTION public.trg_admin_push_review_bonus_appeal();

-- =========================
-- Missing payments
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_missing_payment_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Missing Payment Reported',
    public._admin_push_name(NEW.mover_id, NULL) || ' reported a missing payment' ||
      CASE WHEN NEW.job_number IS NOT NULL THEN ' for job ' || NEW.job_number ELSE '' END,
    jsonb_build_object('reference_type','missing_payment','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_missing_payment_insert ON public.missing_payments;
CREATE TRIGGER admin_push_on_missing_payment_insert
AFTER INSERT ON public.missing_payments
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_missing_payment_insert();

CREATE OR REPLACE FUNCTION public.trg_admin_push_missing_payment_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'Missing Payment Appeal Filed',
    public._admin_push_name(NEW.mover_id, NULL) || ' appealed a missing payment report',
    jsonb_build_object('reference_type','missing_payment','reference_id',NEW.id,'notification_type','admin_appeal_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_missing_payment_appeal ON public.missing_payments;
CREATE TRIGGER admin_push_on_missing_payment_appeal
AFTER UPDATE ON public.missing_payments
FOR EACH ROW
WHEN (COALESCE(NEW.appeal_count,0) > COALESCE(OLD.appeal_count,0))
EXECUTE FUNCTION public.trg_admin_push_missing_payment_appeal();

-- =========================
-- Customer refunds
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_customer_refund_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Customer Refund Submitted',
    public._admin_push_name(NEW.submitted_by, NULL) || ' submitted a refund' ||
      CASE WHEN NEW.customer_name IS NOT NULL THEN ' for ' || NEW.customer_name ELSE '' END,
    jsonb_build_object('reference_type','customer_refund','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_customer_refund_insert ON public.customer_refunds;
CREATE TRIGGER admin_push_on_customer_refund_insert
AFTER INSERT ON public.customer_refunds
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_customer_refund_insert();

-- =========================
-- Performance / misconduct reports
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_performance_report_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Misconduct Report Filed',
    public._admin_push_name(NEW.created_by, NULL) || ' filed a report on ' || COALESCE(NEW.worker_name,'a worker'),
    jsonb_build_object('reference_type','performance_report','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_performance_report_insert ON public.performance_reports;
CREATE TRIGGER admin_push_on_performance_report_insert
AFTER INSERT ON public.performance_reports
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_performance_report_insert();

-- =========================
-- Violence incidents
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_violence_incident_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Violence Incident Reported',
    'Incident reported by ' || COALESCE(NEW.mover_name, public._admin_push_name(NEW.mover_id, 'a mover')),
    jsonb_build_object('reference_type','violence_incident','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_violence_incident_insert ON public.violence_incidents;
CREATE TRIGGER admin_push_on_violence_incident_insert
AFTER INSERT ON public.violence_incidents
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_violence_incident_insert();

-- =========================
-- Payment questions
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_payment_question_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Payment Question',
    COALESCE(NEW.mover_name, public._admin_push_name(NEW.mover_id, 'A mover')) ||
      ' asked: ' || COALESCE(NEW.subject,'a payment question'),
    jsonb_build_object('reference_type','payment_question','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_payment_question_insert ON public.payment_questions;
CREATE TRIGGER admin_push_on_payment_question_insert
AFTER INSERT ON public.payment_questions
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_payment_question_insert();

-- =========================
-- Referral requests
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_referral_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Referral Submitted',
    COALESCE(NEW.referrer_name, public._admin_push_name(NEW.referrer_id, 'A mover')) ||
      ' referred ' || COALESCE(NEW.referred_name,'a candidate'),
    jsonb_build_object('reference_type','referral','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_referral_insert ON public.referral_requests;
CREATE TRIGGER admin_push_on_referral_insert
AFTER INSERT ON public.referral_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_referral_insert();

-- =========================
-- Day-off requests
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_day_off_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Day-Off Request',
    COALESCE(NEW.user_name, public._admin_push_name(NEW.user_id, 'A mover')) ||
      ' requested time off (' || NEW.start_date::text || ' to ' || NEW.end_date::text || ')',
    jsonb_build_object('reference_type','day_off','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_day_off_insert ON public.day_off_requests;
CREATE TRIGGER admin_push_on_day_off_insert
AFTER INSERT ON public.day_off_requests
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_day_off_insert();

-- =========================
-- Mover feedback / suggestions
-- =========================
CREATE OR REPLACE FUNCTION public.trg_admin_push_mover_feedback_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text;
BEGIN
  v_name := CASE
    WHEN NEW.is_anonymous THEN 'An anonymous mover'
    ELSE COALESCE(NEW.mover_name, public._admin_push_name(NEW.mover_id, 'A mover'))
  END;
  PERFORM public.push_admins_on_submission(
    'New Mover Suggestion',
    v_name || ' submitted feedback (' || COALESCE(NEW.priority,'normal') || ' priority)',
    jsonb_build_object('reference_type','mover_feedback','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS admin_push_on_mover_feedback_insert ON public.mover_feedback;
CREATE TRIGGER admin_push_on_mover_feedback_insert
AFTER INSERT ON public.mover_feedback
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_mover_feedback_insert();
