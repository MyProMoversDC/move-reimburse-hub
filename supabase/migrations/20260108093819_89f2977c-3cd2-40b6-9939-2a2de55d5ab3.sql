-- Add employment info columns to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS job_role TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employee_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'not_set';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hire_date DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS termination_date DATE;

-- Add driver's license info columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_class TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS license_expires DATE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS physical_expires DATE;

-- Add custom attributes as JSONB for flexibility
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS custom_attributes JSONB DEFAULT '{
  "a_team": false,
  "b_team": false,
  "c_team": false,
  "available_for_trip_planning": false,
  "can_drive": false,
  "can_pack": false,
  "can_speak": false,
  "cdl": false,
  "military_base": false,
  "hot_tub_spa": false,
  "piano": false,
  "safe": false,
  "tv_mounting": false,
  "washer_dryer_hookup": false,
  "other_mounting": false,
  "special_project": false
}'::jsonb;