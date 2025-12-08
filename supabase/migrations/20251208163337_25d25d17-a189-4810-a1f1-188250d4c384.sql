-- Create enum for review bonus status
CREATE TYPE public.review_bonus_status AS ENUM ('pending', 'confirmed', 'declined');

-- Create review_bonuses table
CREATE TABLE public.review_bonuses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  foreman_name TEXT NOT NULL,
  job_date DATE NOT NULL,
  client_full_name TEXT NOT NULL,
  invoice_number TEXT NOT NULL,
  crew_member_1 TEXT NOT NULL,
  crew_member_2 TEXT NOT NULL,
  crew_member_3 TEXT NOT NULL,
  crew_member_4 TEXT,
  crew_member_5 TEXT,
  crew_member_6 TEXT,
  crew_member_7 TEXT,
  crew_member_8 TEXT,
  review_url TEXT,
  screenshot_url TEXT NOT NULL,
  submission_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  review_month TEXT NOT NULL,
  status review_bonus_status NOT NULL DEFAULT 'pending',
  decline_reason TEXT,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_bonuses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Movers can insert their own review bonuses"
ON public.review_bonuses
FOR INSERT
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Movers can view their own review bonuses"
ON public.review_bonuses
FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all review bonuses"
ON public.review_bonuses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update review bonuses"
ON public.review_bonuses
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for review screenshots
INSERT INTO storage.buckets (id, name, public) VALUES ('review-screenshots', 'review-screenshots', false);

-- Storage policies
CREATE POLICY "Users can upload review screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'review-screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Users can view their own review screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-screenshots' AND auth.role() = 'authenticated');

CREATE POLICY "Admins can view all review screenshots"
ON storage.objects
FOR SELECT
USING (bucket_id = 'review-screenshots' AND has_role(auth.uid(), 'admin'::app_role));