-- Allow operations managers to view all profiles for alcohol test report form
CREATE POLICY "Operations managers can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'operations_manager'::app_role));