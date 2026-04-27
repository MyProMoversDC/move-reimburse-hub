-- Job assignments coming from MovePro Inventory Hub
CREATE TABLE public.job_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  external_job_id UUID NOT NULL UNIQUE,
  job_number TEXT NOT NULL,
  client_name TEXT NOT NULL,
  service_date DATE,
  move_size TEXT,
  scope_of_work TEXT,
  truck_number TEXT,
  callback_url TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.mover_job_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id UUID NOT NULL REFERENCES public.job_assignments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mja_status_chk CHECK (status IN ('pending','confirmed','declined')),
  CONSTRAINT mja_unique UNIQUE (assignment_id, user_id)
);

CREATE INDEX idx_mja_user ON public.mover_job_assignments(user_id, status);
CREATE INDEX idx_mja_assignment ON public.mover_job_assignments(assignment_id);

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mover_job_assignments ENABLE ROW LEVEL SECURITY;

-- Movers can view job_assignments they are assigned to
CREATE POLICY "Movers can view their job assignments"
  ON public.job_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.mover_job_assignments mja
      WHERE mja.assignment_id = job_assignments.id
        AND mja.user_id = auth.uid()
    )
  );

-- Admins can view all job assignments
CREATE POLICY "Admins can view all job assignments"
  ON public.job_assignments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Movers can view their own assignment row
CREATE POLICY "Movers can view their own assignment row"
  ON public.mover_job_assignments
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Admins can view all mover assignment rows
CREATE POLICY "Admins can view all mover assignments"
  ON public.mover_job_assignments
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Movers can update their own row (confirm/decline)
CREATE POLICY "Movers can update their own assignment row"
  ON public.mover_job_assignments
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Reuse existing updated_at trigger function
CREATE TRIGGER trg_ja_updated_at BEFORE UPDATE ON public.job_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_mja_updated_at BEFORE UPDATE ON public.mover_job_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.mover_job_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_assignments;