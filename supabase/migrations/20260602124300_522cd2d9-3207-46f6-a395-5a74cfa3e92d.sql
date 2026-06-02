CREATE POLICY "Admins can insert customer refunds" ON public.customer_refunds
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = submitted_by);