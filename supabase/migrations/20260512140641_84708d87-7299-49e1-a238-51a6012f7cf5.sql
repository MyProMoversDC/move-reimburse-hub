ALTER TABLE public.mover_job_assignments
  ADD COLUMN IF NOT EXISTS arrived_parking_at timestamptz,
  ADD COLUMN IF NOT EXISTS arrived_site_at timestamptz;