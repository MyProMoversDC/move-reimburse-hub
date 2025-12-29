
-- Create enum for feedback areas
CREATE TYPE public.feedback_area AS ENUM (
  'operations',
  'scheduling',
  'equipment',
  'pay',
  'safety',
  'customer_experience',
  'communication',
  'other'
);

-- Create enum for feedback priority
CREATE TYPE public.feedback_priority AS ENUM (
  'needs_attention_soon',
  'general_improvement'
);

-- Create enum for feedback status
CREATE TYPE public.feedback_status AS ENUM (
  'pending',
  'reviewed',
  'responded'
);

-- Create mover_feedback table
CREATE TABLE public.mover_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mover_name TEXT NOT NULL,
  feedback_type TEXT NOT NULL,
  feedback_areas feedback_area[] NOT NULL,
  other_area_explanation TEXT,
  situation_explanation TEXT NOT NULL,
  improvement_suggestion TEXT,
  is_recurring TEXT NOT NULL DEFAULT 'not_sure',
  priority feedback_priority NOT NULL,
  additional_notes TEXT,
  status feedback_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Create mover_feedback_responses table for admin replies
CREATE TABLE public.mover_feedback_responses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  feedback_id UUID NOT NULL REFERENCES public.mover_feedback(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  response_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mover_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mover_feedback_responses ENABLE ROW LEVEL SECURITY;

-- RLS Policies for mover_feedback
CREATE POLICY "Movers can insert their own feedback"
ON public.mover_feedback
FOR INSERT
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Movers can view their own feedback"
ON public.mover_feedback
FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all feedback"
ON public.mover_feedback
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update feedback"
ON public.mover_feedback
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies for mover_feedback_responses
CREATE POLICY "Admins can insert responses"
ON public.mover_feedback_responses
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view all responses"
ON public.mover_feedback_responses
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Movers can view responses to their feedback"
ON public.mover_feedback_responses
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.mover_feedback
  WHERE mover_feedback.id = mover_feedback_responses.feedback_id
  AND mover_feedback.mover_id = auth.uid()
));
