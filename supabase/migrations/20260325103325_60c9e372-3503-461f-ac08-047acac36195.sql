-- Add RLS policy for office_staff to insert customer refunds
CREATE POLICY "Office staff can insert customer refunds"
ON public.customer_refunds
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'office_staff'::app_role) AND auth.uid() = submitted_by);

-- Office staff can view their own customer refunds
CREATE POLICY "Office staff can view own customer refunds"
ON public.customer_refunds
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'office_staff'::app_role) AND auth.uid() = submitted_by);