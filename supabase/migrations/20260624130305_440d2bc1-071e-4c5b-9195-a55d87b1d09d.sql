
-- Planning Calendar: SmartMoving Booked opportunity cache + sync log

CREATE TABLE public.planning_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  smartmoving_id TEXT NOT NULL UNIQUE,
  job_number TEXT,
  customer_name TEXT,
  status TEXT,
  job_type TEXT,
  branch_name TEXT,
  service_date DATE,
  start_time TIMESTAMPTZ,
  end_time TIMESTAMPTZ,
  estimated_total NUMERIC(10,2),
  address TEXT,
  move_size TEXT,
  raw JSONB,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.planning_jobs TO authenticated;
GRANT ALL ON public.planning_jobs TO service_role;
ALTER TABLE public.planning_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_jobs_read" ON public.planning_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'warehouse_keeper'));
CREATE POLICY "planning_jobs_write" ON public.planning_jobs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager'));
CREATE INDEX idx_planning_jobs_service_date ON public.planning_jobs(service_date);
CREATE TRIGGER trg_planning_jobs_updated_at BEFORE UPDATE ON public.planning_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.planning_sync_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  triggered_by UUID REFERENCES auth.users(id),
  from_date DATE,
  to_date DATE,
  status TEXT NOT NULL DEFAULT 'running',
  fetched_count INTEGER NOT NULL DEFAULT 0,
  upserted_count INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE ON public.planning_sync_runs TO authenticated;
GRANT ALL ON public.planning_sync_runs TO service_role;
ALTER TABLE public.planning_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planning_sync_runs_read" ON public.planning_sync_runs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'operations_manager') OR public.has_role(auth.uid(),'warehouse_keeper'));

-- Track which planning_job a created inv_job_order came from (for the "Assigned" badge)
ALTER TABLE public.inv_job_orders
  ADD COLUMN IF NOT EXISTS planned_from_smartmoving_id TEXT;
CREATE INDEX IF NOT EXISTS idx_inv_jo_planned_from_sm
  ON public.inv_job_orders(planned_from_smartmoving_id);
