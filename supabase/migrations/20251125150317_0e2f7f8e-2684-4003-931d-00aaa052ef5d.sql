-- Add 'declined' status to reimbursement_status enum
ALTER TYPE reimbursement_status ADD VALUE IF NOT EXISTS 'declined';

-- Create storage policies for admins and accountants to view reimbursement attachments
CREATE POLICY "Admins can view all reimbursement attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reimbursement-attachments' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Accountants can view all reimbursement attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reimbursement-attachments' 
  AND has_role(auth.uid(), 'accountant'::app_role)
);

CREATE POLICY "Movers can view their own reimbursement attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'reimbursement-attachments'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Create a security definer function to delete users (for admin use)
CREATE OR REPLACE FUNCTION public.delete_user_account(user_id_to_delete uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow admins to delete users
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can delete users';
  END IF;
  
  -- Delete from auth.users (cascade will handle related tables)
  DELETE FROM auth.users WHERE id = user_id_to_delete;
END;
$$;