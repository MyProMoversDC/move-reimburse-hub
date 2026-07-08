
CREATE OR REPLACE FUNCTION public.trg_admin_push_reimbursement_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'New Reimbursement Submitted',
    public._admin_push_name(NEW.mover_id, NULL) || ' submitted reimbursement #' || COALESCE(NEW.reimbursement_number::text,''),
    jsonb_build_object('reference_type','reimbursement','reference_id',NEW.id,'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.trg_admin_push_reimbursement_appeal()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.push_admins_on_submission(
    'Reimbursement Appeal Filed',
    public._admin_push_name(NEW.mover_id, NULL) || ' appealed reimbursement #' || COALESCE(NEW.reimbursement_number::text,''),
    jsonb_build_object('reference_type','reimbursement','reference_id',NEW.id,'notification_type','admin_appeal_submission')
  );
  RETURN NEW;
END $$;
