-- Allow reviews_admin to insert deductibles
CREATE POLICY "Reviews admins can insert deductibles"
ON public.deductibles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reviews_admin'::app_role));