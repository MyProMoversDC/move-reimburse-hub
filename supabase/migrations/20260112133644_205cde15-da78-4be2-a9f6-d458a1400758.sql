-- Create email_logs table to track all email communications
CREATE TABLE public.email_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  from_email TEXT NOT NULL,
  to_emails TEXT[] NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT,
  body_html TEXT,
  email_type TEXT NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  status TEXT NOT NULL DEFAULT 'sent',
  error_message TEXT,
  resend_id TEXT
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view email logs
CREATE POLICY "Admins can view email logs"
ON public.email_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Allow insert from edge functions (service role)
CREATE POLICY "Service role can insert email logs"
ON public.email_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add index for faster queries
CREATE INDEX idx_email_logs_created_at ON public.email_logs(created_at DESC);
CREATE INDEX idx_email_logs_email_type ON public.email_logs(email_type);