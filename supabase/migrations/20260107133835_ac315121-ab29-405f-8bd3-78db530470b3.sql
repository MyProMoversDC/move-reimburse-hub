-- Create handbooks table to store uploaded handbooks
CREATE TABLE public.handbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version INTEGER NOT NULL DEFAULT 1,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  uploaded_by UUID NOT NULL,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  shared_at TIMESTAMP WITH TIME ZONE,
  previous_version_id UUID REFERENCES public.handbooks(id),
  ai_change_summary TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create handbook_acknowledgments table to track who has read the handbook
CREATE TABLE public.handbook_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  handbook_id UUID NOT NULL REFERENCES public.handbooks(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, handbook_id)
);

-- Create user_driver_status table to track driver status and license
CREATE TABLE public.user_driver_status (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  is_driver BOOLEAN,
  driver_prompt_answered BOOLEAN NOT NULL DEFAULT false,
  license_url TEXT,
  license_uploaded_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add address field to profiles if not exists
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Enable RLS on all tables
ALTER TABLE public.handbooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.handbook_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_driver_status ENABLE ROW LEVEL SECURITY;

-- RLS policies for handbooks
CREATE POLICY "Admins can manage handbooks"
  ON public.handbooks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "All users can view shared handbooks"
  ON public.handbooks
  FOR SELECT
  USING (is_shared = true);

-- RLS policies for handbook_acknowledgments
CREATE POLICY "Users can insert their own acknowledgments"
  ON public.handbook_acknowledgments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own acknowledgments"
  ON public.handbook_acknowledgments
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all acknowledgments"
  ON public.handbook_acknowledgments
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for user_driver_status
CREATE POLICY "Users can manage their own driver status"
  ON public.user_driver_status
  FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all driver statuses"
  ON public.user_driver_status
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR managers can view all driver statuses"
  ON public.user_driver_status
  FOR SELECT
  USING (has_role(auth.uid(), 'hr_manager'::app_role));

-- Allow admins and HR managers to update profiles (for address)
CREATE POLICY "Admins can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR managers can update all profiles"
  ON public.profiles
  FOR UPDATE
  USING (has_role(auth.uid(), 'hr_manager'::app_role));

-- Create storage bucket for handbooks
INSERT INTO storage.buckets (id, name, public) VALUES ('handbooks', 'handbooks', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for handbooks bucket
CREATE POLICY "Admins can upload handbooks"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'handbooks' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can view handbooks"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'handbooks');

CREATE POLICY "Admins can delete handbooks"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'handbooks' AND has_role(auth.uid(), 'admin'::app_role));

-- Create storage bucket for driver licenses
INSERT INTO storage.buckets (id, name, public) VALUES ('driver-licenses', 'driver-licenses', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for driver-licenses bucket
CREATE POLICY "Users can upload their own license"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'driver-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their own license"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'driver-licenses' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Admins can view all licenses"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'driver-licenses' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR managers can view all licenses"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'driver-licenses' AND has_role(auth.uid(), 'hr_manager'::app_role));