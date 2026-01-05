-- Create table to track review bonus appeal history
CREATE TABLE public.review_bonus_appeal_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  review_bonus_id UUID NOT NULL REFERENCES public.review_bonuses(id) ON DELETE CASCADE,
  appeal_number INTEGER NOT NULL, -- 1 for first appeal, 2 for final appeal
  appeal_note TEXT NOT NULL,
  appeal_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  decline_reason TEXT, -- Set when this appeal is declined
  declined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.review_bonus_appeal_history ENABLE ROW LEVEL SECURITY;

-- Movers can view their own appeal history
CREATE POLICY "Movers can view their own appeal history" 
ON public.review_bonus_appeal_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM review_bonuses 
  WHERE review_bonuses.id = review_bonus_appeal_history.review_bonus_id 
  AND review_bonuses.mover_id = auth.uid()
));

-- Movers can insert their own appeal history
CREATE POLICY "Movers can insert their own appeal history" 
ON public.review_bonus_appeal_history 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM review_bonuses 
  WHERE review_bonuses.id = review_bonus_appeal_history.review_bonus_id 
  AND review_bonuses.mover_id = auth.uid()
));

-- Admins can view all appeal history
CREATE POLICY "Admins can view all appeal history" 
ON public.review_bonus_appeal_history 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update appeal history (to set decline reason)
CREATE POLICY "Admins can update appeal history" 
ON public.review_bonus_appeal_history 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Reviews admins can view all appeal history
CREATE POLICY "Reviews admins can view all appeal history" 
ON public.review_bonus_appeal_history 
FOR SELECT 
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Reviews admins can update appeal history (to set decline reason)
CREATE POLICY "Reviews admins can update appeal history" 
ON public.review_bonus_appeal_history 
FOR UPDATE 
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Add appeal_history_id column to review_appeal_attachments to link to specific appeal
ALTER TABLE public.review_appeal_attachments 
ADD COLUMN appeal_history_id UUID REFERENCES public.review_bonus_appeal_history(id) ON DELETE CASCADE;