-- Create storage bucket for reimbursement attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('reimbursement-attachments', 'reimbursement-attachments', false);

-- Storage RLS policies
CREATE POLICY "Users can upload their own attachments"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reimbursement-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can view their own attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-attachments' AND
    auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Admins can view all attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-attachments' AND
    public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Accountants can view all attachments"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reimbursement-attachments' AND
    public.has_role(auth.uid(), 'accountant')
  );