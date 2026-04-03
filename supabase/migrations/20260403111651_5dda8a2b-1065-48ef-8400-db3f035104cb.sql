
-- Create status enum for shifts
CREATE TYPE public.shift_status AS ENUM ('pending', 'confirmed', 'cancelled');

-- Create status enum for day off requests
CREATE TYPE public.day_off_status AS ENUM ('pending', 'approved', 'declined');

-- Shifts table - admin-assigned schedules
CREATE TABLE public.shifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status shift_status NOT NULL DEFAULT 'pending',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all shifts" ON public.shifts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own shifts" ON public.shifts FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own shift status to confirmed" ON public.shifts FOR UPDATE TO authenticated
  USING (auth.uid() = user_id AND status = 'pending'::shift_status)
  WITH CHECK (auth.uid() = user_id AND status = 'confirmed'::shift_status);

-- Shift clock entries
CREATE TABLE public.shift_clock_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  shift_id uuid REFERENCES public.shifts(id) ON DELETE SET NULL,
  clock_in timestamptz NOT NULL DEFAULT now(),
  clock_out timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_clock_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all clock entries" ON public.shift_clock_entries FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own clock entries" ON public.shift_clock_entries FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clock entries" ON public.shift_clock_entries FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clock entries" ON public.shift_clock_entries FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Shift breaks
CREATE TABLE public.shift_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clock_entry_id uuid NOT NULL REFERENCES public.shift_clock_entries(id) ON DELETE CASCADE,
  break_start timestamptz NOT NULL DEFAULT now(),
  break_end timestamptz,
  duration_minutes integer NOT NULL DEFAULT 15,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_breaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all breaks" ON public.shift_breaks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own breaks" ON public.shift_breaks FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shift_clock_entries
    WHERE shift_clock_entries.id = shift_breaks.clock_entry_id
    AND shift_clock_entries.user_id = auth.uid()
  ));

CREATE POLICY "Users can insert their own breaks" ON public.shift_breaks FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.shift_clock_entries
    WHERE shift_clock_entries.id = shift_breaks.clock_entry_id
    AND shift_clock_entries.user_id = auth.uid()
  ));

CREATE POLICY "Users can update their own breaks" ON public.shift_breaks FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.shift_clock_entries
    WHERE shift_clock_entries.id = shift_breaks.clock_entry_id
    AND shift_clock_entries.user_id = auth.uid()
  ));

-- Day off requests
CREATE TABLE public.day_off_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_partial_day boolean NOT NULL DEFAULT false,
  partial_start_time time,
  partial_end_time time,
  reason text,
  status day_off_status NOT NULL DEFAULT 'pending',
  decline_reason text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.day_off_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all day off requests" ON public.day_off_requests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own day off requests" ON public.day_off_requests FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own day off requests" ON public.day_off_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Shift hourly rates for non-mover roles
CREATE TABLE public.shift_hourly_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  hourly_rate numeric NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.shift_hourly_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all hourly rates" ON public.shift_hourly_rates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own hourly rate" ON public.shift_hourly_rates FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can upsert their own hourly rate" ON public.shift_hourly_rates FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own hourly rate" ON public.shift_hourly_rates FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);
