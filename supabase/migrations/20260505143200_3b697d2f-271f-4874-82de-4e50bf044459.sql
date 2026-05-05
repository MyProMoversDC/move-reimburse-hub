
-- Track job lifecycle on mover assignments
ALTER TABLE public.mover_job_assignments
  ADD COLUMN IF NOT EXISTS started_at timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at timestamptz;

-- Allow new statuses
ALTER TABLE public.mover_job_assignments DROP CONSTRAINT IF EXISTS mja_status_chk;
ALTER TABLE public.mover_job_assignments
  ADD CONSTRAINT mja_status_chk
  CHECK (status = ANY (ARRAY['pending','confirmed','declined','in_progress','completed']));

-- Location pings table
CREATE TABLE IF NOT EXISTS public.job_location_pings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_assignment_id uuid NOT NULL REFERENCES public.mover_job_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy double precision,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_jlp_assignment ON public.job_location_pings(mover_assignment_id, recorded_at);
CREATE INDEX IF NOT EXISTS idx_jlp_user ON public.job_location_pings(user_id, recorded_at);

ALTER TABLE public.job_location_pings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movers can insert their own pings"
  ON public.job_location_pings FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Movers can view their own pings"
  ON public.job_location_pings FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all pings"
  ON public.job_location_pings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
