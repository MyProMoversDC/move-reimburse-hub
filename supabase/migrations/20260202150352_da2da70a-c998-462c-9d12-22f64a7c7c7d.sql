-- Create a table to store signed consent documents for HR
CREATE TABLE IF NOT EXISTS public.signed_consent_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  consent_document_id uuid NOT NULL REFERENCES public.consent_documents(id) ON DELETE CASCADE,
  signature_url text NOT NULL,
  signed_at timestamp with time zone NOT NULL DEFAULT now(),
  mover_name text NOT NULL,
  document_name text NOT NULL,
  CONSTRAINT unique_user_consent UNIQUE (user_id, consent_document_id)
);

-- Enable RLS on signed_consent_documents
ALTER TABLE public.signed_consent_documents ENABLE ROW LEVEL SECURITY;

-- RLS policies for signed_consent_documents
CREATE POLICY "Admins can view all signed consent documents"
ON public.signed_consent_documents
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "HR managers can view all signed consent documents"
ON public.signed_consent_documents
FOR SELECT
USING (has_role(auth.uid(), 'hr_manager'::app_role));

CREATE POLICY "Users can insert their own signed consent"
ON public.signed_consent_documents
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own signed consent"
ON public.signed_consent_documents
FOR SELECT
USING (auth.uid() = user_id);