-- Add DELETE policy for consent_acknowledgments so admins can delete acknowledgments
CREATE POLICY "Admins can delete consent acknowledgments"
ON public.consent_acknowledgments
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Add DELETE policy for signed_consent_documents so admins can delete signed documents
CREATE POLICY "Admins can delete signed consent documents"
ON public.signed_consent_documents
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'::app_role));