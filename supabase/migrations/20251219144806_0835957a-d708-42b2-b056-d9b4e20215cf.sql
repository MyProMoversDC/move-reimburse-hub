-- Create storage bucket for performance report attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('performance-report-attachments', 'performance-report-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Create table for performance report attachments
CREATE TABLE IF NOT EXISTS public.performance_report_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID NOT NULL REFERENCES public.performance_reports(id) ON DELETE CASCADE,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.performance_report_attachments ENABLE ROW LEVEL SECURITY;

-- RLS policies for performance_report_attachments
CREATE POLICY "Operations managers can view attachments"
ON public.performance_report_attachments
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.performance_reports pr
    WHERE pr.id = performance_report_attachments.report_id
  ) AND has_role(auth.uid(), 'operations_manager'::app_role)
);

CREATE POLICY "Admins can view all attachments"
ON public.performance_report_attachments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Operations managers can insert attachments"
ON public.performance_report_attachments
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'operations_manager'::app_role));

CREATE POLICY "Operations managers can delete attachments"
ON public.performance_report_attachments
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'operations_manager'::app_role));

-- Storage policies for the bucket
CREATE POLICY "Operations managers can upload attachments"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'performance-report-attachments' 
  AND has_role(auth.uid(), 'operations_manager'::app_role)
);

CREATE POLICY "Authenticated users can view performance attachments"
ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'performance-report-attachments'
  AND (
    has_role(auth.uid(), 'operations_manager'::app_role)
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Operations managers can delete their attachments"
ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'performance-report-attachments'
  AND has_role(auth.uid(), 'operations_manager'::app_role)
);