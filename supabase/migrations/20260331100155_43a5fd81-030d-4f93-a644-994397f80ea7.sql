
-- Create referral status enum
CREATE TYPE public.referral_status AS ENUM ('pending', 'approved', 'declined', 'bonus_eligible', 'bonus_claimed', 'bonus_paid');

-- Create referral requests table
CREATE TABLE public.referral_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID NOT NULL,
  referrer_name TEXT NOT NULL,
  referred_name TEXT NOT NULL,
  referred_position TEXT NOT NULL CHECK (referred_position IN ('driver', 'moving_helper')),
  available_date DATE NOT NULL,
  license_url TEXT,
  license_file_name TEXT,
  status referral_status NOT NULL DEFAULT 'pending',
  admin_start_date DATE,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  declined_at TIMESTAMPTZ,
  decline_reason TEXT,
  bonus_eligible_at TIMESTAMPTZ,
  bonus_claimed_at TIMESTAMPTZ,
  bonus_paid_at TIMESTAMPTZ,
  bonus_amount NUMERIC,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Movers can insert their own referrals"
ON public.referral_requests FOR INSERT TO authenticated
WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Movers can view their own referrals"
ON public.referral_requests FOR SELECT TO authenticated
USING (auth.uid() = referrer_id);

CREATE POLICY "Movers can update their own referrals for claiming"
ON public.referral_requests FOR UPDATE TO authenticated
USING (auth.uid() = referrer_id AND status = 'bonus_eligible')
WITH CHECK (auth.uid() = referrer_id AND status = 'bonus_claimed');

CREATE POLICY "Admins can view all referrals"
ON public.referral_requests FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update referrals"
ON public.referral_requests FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for referral license uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('referral-licenses', 'referral-licenses', false);

-- Storage policies
CREATE POLICY "Movers can upload referral licenses"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'referral-licenses' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Movers can view their own referral licenses"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'referral-licenses' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Admins can view all referral licenses"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'referral-licenses' AND has_role(auth.uid(), 'admin'::app_role));
