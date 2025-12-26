-- Create enum for incident types
CREATE TYPE public.violence_incident_type AS ENUM (
  'verbal_threat',
  'physical_contact',
  'property_damage',
  'harassment',
  'weapon_seen',
  'other'
);

-- Create enum for severity levels
CREATE TYPE public.violence_severity_level AS ENUM (
  'low',
  'medium',
  'high',
  'critical'
);

-- Create violence incidents table
CREATE TABLE public.violence_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id UUID NOT NULL,
  mover_name TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  incident_date DATE NOT NULL,
  incident_time TIME NOT NULL,
  job_id TEXT NOT NULL,
  incident_address TEXT NOT NULL,
  client_name TEXT NOT NULL,
  incident_types violence_incident_type[] NOT NULL,
  incident_description TEXT NOT NULL,
  anyone_injured BOOLEAN NOT NULL DEFAULT false,
  injury_description TEXT,
  property_damaged BOOLEAN NOT NULL DEFAULT false,
  damage_description TEXT,
  police_contacted BOOLEAN NOT NULL DEFAULT false,
  emergency_services_called BOOLEAN NOT NULL DEFAULT false,
  severity_level violence_severity_level NOT NULL,
  admin_actions TEXT,
  operations_manager_actions TEXT
);

-- Create table for violence incident attachments
CREATE TABLE public.violence_incident_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incident_id UUID NOT NULL REFERENCES public.violence_incidents(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.violence_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.violence_incident_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for violence_incidents
CREATE POLICY "Movers can insert their own incidents"
ON public.violence_incidents FOR INSERT
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Movers can view their own incidents"
ON public.violence_incidents FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all incidents"
ON public.violence_incidents FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update incidents"
ON public.violence_incidents FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operations managers can view all incidents"
ON public.violence_incidents FOR SELECT
USING (has_role(auth.uid(), 'operations_manager'::app_role));

CREATE POLICY "Operations managers can update incidents"
ON public.violence_incidents FOR UPDATE
USING (has_role(auth.uid(), 'operations_manager'::app_role));

-- RLS Policies for violence_incident_attachments
CREATE POLICY "Movers can insert their own attachments"
ON public.violence_incident_attachments FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.violence_incidents
  WHERE id = incident_id AND mover_id = auth.uid()
));

CREATE POLICY "Movers can view their own attachments"
ON public.violence_incident_attachments FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.violence_incidents
  WHERE id = incident_id AND mover_id = auth.uid()
));

CREATE POLICY "Admins can view all attachments"
ON public.violence_incident_attachments FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operations managers can view all attachments"
ON public.violence_incident_attachments FOR SELECT
USING (has_role(auth.uid(), 'operations_manager'::app_role));

-- Create storage bucket for violence incident attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('violence-incident-attachments', 'violence-incident-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for violence incident attachments
CREATE POLICY "Movers can upload their own violence incident files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'violence-incident-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view violence incident files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'violence-incident-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can delete violence incident files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'violence-incident-attachments' AND
  has_role(auth.uid(), 'admin'::app_role)
);