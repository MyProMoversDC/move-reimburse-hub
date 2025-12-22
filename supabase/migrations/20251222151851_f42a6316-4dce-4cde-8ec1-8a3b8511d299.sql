-- Add appeal columns to reimbursements table
ALTER TABLE public.reimbursements
ADD COLUMN IF NOT EXISTS appeal_note text,
ADD COLUMN IF NOT EXISTS appeal_at timestamp with time zone;

-- Add appeal columns to review_bonuses table
ALTER TABLE public.review_bonuses
ADD COLUMN IF NOT EXISTS appeal_note text,
ADD COLUMN IF NOT EXISTS appeal_at timestamp with time zone;

-- Create appeal_attachments table for reimbursement appeals
CREATE TABLE IF NOT EXISTS public.reimbursement_appeal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reimbursement_id uuid NOT NULL REFERENCES public.reimbursements(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Create appeal_attachments table for review bonus appeals
CREATE TABLE IF NOT EXISTS public.review_appeal_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_bonus_id uuid NOT NULL REFERENCES public.review_bonuses(id) ON DELETE CASCADE,
  file_url text NOT NULL,
  file_name text NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE public.reimbursement_appeal_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.review_appeal_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for reimbursement_appeal_attachments
CREATE POLICY "Movers can insert their own appeal attachments"
ON public.reimbursement_appeal_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.reimbursements
    WHERE reimbursements.id = reimbursement_appeal_attachments.reimbursement_id
    AND reimbursements.mover_id = auth.uid()
  )
);

CREATE POLICY "Movers can view their own appeal attachments"
ON public.reimbursement_appeal_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.reimbursements
    WHERE reimbursements.id = reimbursement_appeal_attachments.reimbursement_id
    AND reimbursements.mover_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all reimbursement appeal attachments"
ON public.reimbursement_appeal_attachments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for review_appeal_attachments
CREATE POLICY "Movers can insert their own review appeal attachments"
ON public.review_appeal_attachments
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.review_bonuses
    WHERE review_bonuses.id = review_appeal_attachments.review_bonus_id
    AND review_bonuses.mover_id = auth.uid()
  )
);

CREATE POLICY "Movers can view their own review appeal attachments"
ON public.review_appeal_attachments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.review_bonuses
    WHERE review_bonuses.id = review_appeal_attachments.review_bonus_id
    AND review_bonuses.mover_id = auth.uid()
  )
);

CREATE POLICY "Admins can view all review appeal attachments"
ON public.review_appeal_attachments
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reviews admins can view all review appeal attachments"
ON public.review_appeal_attachments
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Add RLS policies for reviews_admin role on review_bonuses
CREATE POLICY "Reviews admins can view all review bonuses"
ON public.review_bonuses
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

CREATE POLICY "Reviews admins can update review bonuses"
ON public.review_bonuses
FOR UPDATE
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Allow movers to update their declined submissions to appeal
CREATE POLICY "Movers can update their own declined reimbursements to appeal"
ON public.reimbursements
FOR UPDATE
USING (auth.uid() = mover_id AND status = 'declined')
WITH CHECK (auth.uid() = mover_id AND status = 'appeal');

CREATE POLICY "Movers can update their own declined reviews to appeal"
ON public.review_bonuses
FOR UPDATE
USING (auth.uid() = mover_id AND status = 'declined')
WITH CHECK (auth.uid() = mover_id AND status = 'appeal');

-- Create storage bucket for appeal attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('appeal-attachments', 'appeal-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for appeal attachments
CREATE POLICY "Users can upload appeal attachments"
ON storage.objects
FOR INSERT
WITH CHECK (bucket_id = 'appeal-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own appeal attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'appeal-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all appeal attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'appeal-attachments' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reviews admins can view review appeal attachments"
ON storage.objects
FOR SELECT
USING (bucket_id = 'appeal-attachments' AND has_role(auth.uid(), 'reviews_admin'::app_role));