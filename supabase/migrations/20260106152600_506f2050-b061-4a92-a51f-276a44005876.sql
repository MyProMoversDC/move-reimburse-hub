-- Allow HR managers to view all profiles
CREATE POLICY "HR managers can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'hr_manager'::app_role));