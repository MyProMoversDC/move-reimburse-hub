
-- 1. Optional SmartMoving employee id on profiles (nullable, admins fill later)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS smartmoving_employee_id TEXT;
CREATE INDEX IF NOT EXISTS profiles_smartmoving_employee_id_idx
  ON public.profiles (smartmoving_employee_id)
  WHERE smartmoving_employee_id IS NOT NULL;

-- 2. pay_stub_batches
CREATE TABLE public.pay_stub_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_date DATE NOT NULL,
  source TEXT NOT NULL DEFAULT 'smartmoving_cron',
  status TEXT NOT NULL DEFAULT 'processing',
  total_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_stub_batches TO authenticated;
GRANT ALL ON public.pay_stub_batches TO service_role;
ALTER TABLE public.pay_stub_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Reviews Admins can view pay stub batches"
  ON public.pay_stub_batches FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can insert pay stub batches"
  ON public.pay_stub_batches FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can update pay stub batches"
  ON public.pay_stub_batches FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE TRIGGER trg_pay_stub_batches_updated
  BEFORE UPDATE ON public.pay_stub_batches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. pay_stubs
CREATE TABLE public.pay_stubs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id UUID NOT NULL REFERENCES public.pay_stub_batches(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  smartmoving_employee_id TEXT,
  extracted_name TEXT,
  mover_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  pay_period_start DATE,
  pay_period_end DATE,
  net_total NUMERIC(12,2),
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  sent_at TIMESTAMPTZ,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  discarded_at TIMESTAMPTZ,
  discarded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pay_stubs_batch_id_idx ON public.pay_stubs (batch_id);
CREATE INDEX pay_stubs_mover_id_idx ON public.pay_stubs (mover_id);
CREATE INDEX pay_stubs_status_idx ON public.pay_stubs (status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pay_stubs TO authenticated;
GRANT ALL ON public.pay_stubs TO service_role;
ALTER TABLE public.pay_stubs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Reviews Admins can view pay stubs"
  ON public.pay_stubs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can insert pay stubs"
  ON public.pay_stubs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can update pay stubs"
  ON public.pay_stubs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can delete pay stubs"
  ON public.pay_stubs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE TRIGGER trg_pay_stubs_updated
  BEFORE UPDATE ON public.pay_stubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. pay_stub_send_log (append-only audit)
CREATE TABLE public.pay_stub_send_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_stub_id UUID NOT NULL REFERENCES public.pay_stubs(id) ON DELETE CASCADE,
  mover_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  status TEXT NOT NULL,
  error TEXT,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX pay_stub_send_log_pay_stub_id_idx ON public.pay_stub_send_log (pay_stub_id);

GRANT SELECT, INSERT ON public.pay_stub_send_log TO authenticated;
GRANT ALL ON public.pay_stub_send_log TO service_role;
ALTER TABLE public.pay_stub_send_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and Reviews Admins can view pay stub send log"
  ON public.pay_stub_send_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

CREATE POLICY "Admins and Reviews Admins can insert pay stub send log"
  ON public.pay_stub_send_log FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role));

-- 5. Storage RLS on pay-stubs bucket (private)
CREATE POLICY "Admins and Reviews Admins can read pay stub files"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'pay-stubs'
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role))
  );

CREATE POLICY "Admins and Reviews Admins can upload pay stub files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'pay-stubs'
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role))
  );

CREATE POLICY "Admins and Reviews Admins can delete pay stub files"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'pay-stubs'
    AND (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'reviews_admin'::app_role))
  );
