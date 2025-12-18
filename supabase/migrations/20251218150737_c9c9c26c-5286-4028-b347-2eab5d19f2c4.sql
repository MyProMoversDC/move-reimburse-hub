-- Create performance_reports table
CREATE TABLE public.performance_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  incident_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  worker_name TEXT NOT NULL,
  incident_category TEXT NOT NULL,
  incident_description TEXT NOT NULL,
  severity_level TEXT NOT NULL CHECK (severity_level IN ('Low', 'Medium', 'High', 'Critical')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.performance_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_reports FORCE ROW LEVEL SECURITY;

-- Create PERMISSIVE policies for operations_manager only
CREATE POLICY "Operations managers can view all reports"
ON public.performance_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'operations_manager'::app_role));

CREATE POLICY "Operations managers can insert reports"
ON public.performance_reports FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'operations_manager'::app_role) AND auth.uid() = created_by);

CREATE POLICY "Operations managers can update reports"
ON public.performance_reports FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'operations_manager'::app_role));

CREATE POLICY "Operations managers can delete reports"
ON public.performance_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'operations_manager'::app_role));

-- Also allow admins to view reports
CREATE POLICY "Admins can view all performance reports"
ON public.performance_reports FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));