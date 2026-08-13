ALTER TABLE public.day_off_requests
  ADD COLUMN IF NOT EXISTS request_type text NOT NULL DEFAULT 'staff',
  ADD COLUMN IF NOT EXISTS reason_category text,
  ADD COLUMN IF NOT EXISTS reason_other text,
  ADD COLUMN IF NOT EXISTS comment text,
  ADD COLUMN IF NOT EXISTS submitted_language text NOT NULL DEFAULT 'en';

CREATE INDEX IF NOT EXISTS idx_day_off_requests_type_status
  ON public.day_off_requests (request_type, status, created_at DESC);