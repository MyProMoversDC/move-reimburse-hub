
-- ============================================================
-- MOVER PERFORMANCE SCORE SYSTEM
-- ============================================================

-- 1. mover_ratings: one row per mover, current score & stars
CREATE TABLE public.mover_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 40,
  stars NUMERIC(2,1) GENERATED ALWAYS AS (ROUND((score::numeric / 10.0)::numeric, 1)) STORED,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT mover_ratings_score_range CHECK (score >= 10 AND score <= 50)
);

GRANT SELECT ON public.mover_ratings TO authenticated;
GRANT ALL ON public.mover_ratings TO service_role;

ALTER TABLE public.mover_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movers view own rating"
  ON public.mover_ratings FOR SELECT
  TO authenticated
  USING (mover_id = auth.uid());

CREATE POLICY "Admins view all ratings"
  ON public.mover_ratings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR view all ratings"
  ON public.mover_ratings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr_manager'::app_role));

-- 2. mover_rating_events: full audit trail of every score change
CREATE TABLE public.mover_rating_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mover_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  delta INTEGER NOT NULL,
  reason TEXT,
  source_id UUID,
  source_table TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mover_rating_events_mover_id ON public.mover_rating_events(mover_id);
CREATE INDEX idx_mover_rating_events_created_at ON public.mover_rating_events(created_at DESC);
CREATE INDEX idx_mover_rating_events_event_type ON public.mover_rating_events(event_type);

GRANT SELECT ON public.mover_rating_events TO authenticated;
GRANT ALL ON public.mover_rating_events TO service_role;

ALTER TABLE public.mover_rating_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Movers view own rating events"
  ON public.mover_rating_events FOR SELECT
  TO authenticated
  USING (mover_id = auth.uid());

CREATE POLICY "Admins view all rating events"
  ON public.mover_rating_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR view all rating events"
  ON public.mover_rating_events FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'hr_manager'::app_role));

-- No direct insert/update from client — all changes go through edge function (service role)

-- 3. SECURITY DEFINER: apply a rating event atomically
CREATE OR REPLACE FUNCTION public.apply_rating_event(
  _mover_id UUID,
  _event_type TEXT,
  _delta INTEGER,
  _reason TEXT,
  _source_id UUID,
  _source_table TEXT,
  _created_by UUID
)
RETURNS TABLE(new_score INTEGER, new_stars NUMERIC, event_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
  v_event_id UUID;
BEGIN
  -- Ensure rating row exists
  INSERT INTO public.mover_ratings (mover_id, score)
  VALUES (_mover_id, 40)
  ON CONFLICT (mover_id) DO NOTHING;

  SELECT score INTO v_current FROM public.mover_ratings WHERE mover_id = _mover_id FOR UPDATE;

  v_new := GREATEST(10, LEAST(50, v_current + _delta));

  -- Record audit event
  INSERT INTO public.mover_rating_events (mover_id, event_type, delta, reason, source_id, source_table, created_by)
  VALUES (_mover_id, _event_type, _delta, _reason, _source_id, _source_table, _created_by)
  RETURNING id INTO v_event_id;

  UPDATE public.mover_ratings
    SET score = v_new, updated_at = now()
    WHERE mover_id = _mover_id;

  RETURN QUERY
    SELECT v_new, ROUND((v_new::numeric / 10.0)::numeric, 1), v_event_id;
END;
$$;

-- 4. Helper: check last positive manual adjustment for 30-day cap
CREATE OR REPLACE FUNCTION public.last_positive_manual_adjustment(_mover_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT MAX(created_at)
  FROM public.mover_rating_events
  WHERE mover_id = _mover_id
    AND source_table = 'manual_adjustment'
    AND delta > 0;
$$;
