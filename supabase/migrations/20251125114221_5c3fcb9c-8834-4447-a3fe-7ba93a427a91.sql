-- Allow admins and accountants to view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all profiles"
ON public.profiles
FOR SELECT
USING (has_role(auth.uid(), 'accountant'::app_role));