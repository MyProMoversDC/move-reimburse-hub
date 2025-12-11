-- 1. Add DELETE RLS policies for reimbursements table
CREATE POLICY "Admins can delete reimbursements"
ON public.reimbursements
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Add DELETE RLS policies for reimbursement_attachments table
CREATE POLICY "Admins can delete attachments"
ON public.reimbursement_attachments
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.reimbursements
    WHERE id = reimbursement_attachments.reimbursement_id
    AND has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 3. Fix overly permissive storage policies for review-screenshots bucket
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can upload review screenshots" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own review screenshots" ON storage.objects;

-- Create properly scoped INSERT policy (user-folder enforcement)
CREATE POLICY "Users can upload their own review screenshots"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'review-screenshots' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create properly scoped SELECT policy (own files + admin access)
CREATE POLICY "Movers can view their own review screenshots"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'review-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Add DELETE policy for cleanup
CREATE POLICY "Users can delete their own review screenshots"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'review-screenshots'
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- 4. Configure storage bucket limits for file validation
UPDATE storage.buckets
SET 
  file_size_limit = 5242880,  -- 5MB in bytes
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
WHERE id IN ('reimbursement-attachments', 'review-screenshots');