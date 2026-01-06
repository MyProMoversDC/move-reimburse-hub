-- Create table for HR documents
CREATE TABLE public.hr_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  notes TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hr_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for hr_documents - only HR managers and admins can access
CREATE POLICY "HR managers can view all documents"
ON public.hr_documents
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr_manager'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "HR managers can insert documents"
ON public.hr_documents
FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'hr_manager'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "HR managers can update documents"
ON public.hr_documents
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr_manager'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "HR managers can delete documents"
ON public.hr_documents
FOR DELETE
TO authenticated
USING (
  public.has_role(auth.uid(), 'hr_manager'::app_role) OR 
  public.has_role(auth.uid(), 'admin'::app_role)
);

-- Create trigger for updated_at
CREATE TRIGGER update_hr_documents_updated_at
BEFORE UPDATE ON public.hr_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for HR documents
INSERT INTO storage.buckets (id, name, public) VALUES ('hr-documents', 'hr-documents', false);

-- Storage policies for hr-documents bucket
CREATE POLICY "HR managers can upload documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'hr-documents' AND
  (public.has_role(auth.uid(), 'hr_manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "HR managers can view documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'hr-documents' AND
  (public.has_role(auth.uid(), 'hr_manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "HR managers can delete documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'hr-documents' AND
  (public.has_role(auth.uid(), 'hr_manager'::app_role) OR public.has_role(auth.uid(), 'admin'::app_role))
);