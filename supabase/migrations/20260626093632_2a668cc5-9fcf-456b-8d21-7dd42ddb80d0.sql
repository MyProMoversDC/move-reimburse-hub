
-- Truck status management
DO $$ BEGIN
  CREATE TYPE public.truck_manual_status AS ENUM ('active','under_maintenance','inactive','out_of_service');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.trucks
  ADD COLUMN IF NOT EXISTS manual_status public.truck_manual_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS maintenance_start_date date,
  ADD COLUMN IF NOT EXISTS maintenance_end_date date,
  ADD COLUMN IF NOT EXISTS maintenance_notes text;

-- Backfill manual_status from is_active for existing rows
UPDATE public.trucks SET manual_status = 'inactive' WHERE is_active = false AND manual_status = 'active';

-- Keep is_active in sync (backward compat with existing queries)
CREATE OR REPLACE FUNCTION public.sync_truck_is_active()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.is_active := (NEW.manual_status = 'active' OR NEW.manual_status = 'under_maintenance');
  -- Validate maintenance dates
  IF NEW.manual_status = 'under_maintenance' THEN
    IF NEW.maintenance_start_date IS NULL OR NEW.maintenance_end_date IS NULL THEN
      RAISE EXCEPTION 'Maintenance start and end dates are required when status is under_maintenance';
    END IF;
    IF NEW.maintenance_end_date < NEW.maintenance_start_date THEN
      RAISE EXCEPTION 'Maintenance end date must be on or after start date';
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_sync_truck_is_active ON public.trucks;
CREATE TRIGGER trg_sync_truck_is_active
  BEFORE INSERT OR UPDATE ON public.trucks
  FOR EACH ROW EXECUTE FUNCTION public.sync_truck_is_active();

-- Compute truck status for a given target date
CREATE OR REPLACE FUNCTION public.get_truck_status(_truck_id uuid, _date date DEFAULT CURRENT_DATE, _exclude_job_id uuid DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_truck RECORD;
  v_in_use boolean;
  v_reserved boolean;
BEGIN
  SELECT manual_status, maintenance_start_date, maintenance_end_date
    INTO v_truck FROM public.trucks WHERE id = _truck_id;
  IF NOT FOUND THEN RETURN 'unknown'; END IF;

  IF v_truck.manual_status = 'out_of_service' THEN RETURN 'out_of_service'; END IF;
  IF v_truck.manual_status = 'inactive' THEN RETURN 'inactive'; END IF;

  IF v_truck.manual_status = 'under_maintenance'
     AND v_truck.maintenance_start_date IS NOT NULL
     AND v_truck.maintenance_end_date IS NOT NULL
     AND _date BETWEEN v_truck.maintenance_start_date AND v_truck.maintenance_end_date THEN
    RETURN 'under_maintenance';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inv_job_orders jo
    WHERE jo.truck_id = _truck_id
      AND jo.job_date = _date
      AND jo.status = 'in_progress'
      AND (_exclude_job_id IS NULL OR jo.id <> _exclude_job_id)
  ) INTO v_in_use;
  IF v_in_use THEN RETURN 'in_use'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.inv_job_orders jo
    WHERE jo.truck_id = _truck_id
      AND jo.job_date = _date
      AND jo.status NOT IN ('completed','cancelled')
      AND (_exclude_job_id IS NULL OR jo.id <> _exclude_job_id)
  ) INTO v_reserved;
  IF v_reserved THEN RETURN 'reserved'; END IF;

  RETURN 'active';
END $$;

-- List trucks with their computed status for a given date
CREATE OR REPLACE FUNCTION public.list_trucks_with_status(_date date DEFAULT CURRENT_DATE, _exclude_job_id uuid DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  truck_number text,
  license_plate text,
  capacity_notes text,
  manual_status text,
  maintenance_start_date date,
  maintenance_end_date date,
  maintenance_notes text,
  computed_status text,
  is_available boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id, t.truck_number, t.license_plate, t.capacity_notes,
    t.manual_status::text, t.maintenance_start_date, t.maintenance_end_date, t.maintenance_notes,
    public.get_truck_status(t.id, _date, _exclude_job_id) AS computed_status,
    (public.get_truck_status(t.id, _date, _exclude_job_id) = 'active') AS is_available
  FROM public.trucks t
  ORDER BY t.truck_number;
$$;

GRANT EXECUTE ON FUNCTION public.get_truck_status(uuid,date,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_trucks_with_status(date,uuid) TO authenticated;
