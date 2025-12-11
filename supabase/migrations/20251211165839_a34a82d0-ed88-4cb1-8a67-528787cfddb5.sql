-- 1. Drop existing overly permissive policies
DROP POLICY IF EXISTS "Anyone can view user roles" ON public.user_roles;
DROP POLICY IF EXISTS "System can insert user roles" ON public.user_roles;

-- 2. Create secure SELECT policies
-- Users can only view their own role assignments
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all role assignments
CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create secure INSERT policy (only via trigger/service role)
-- This restricts INSERT to the service role (used by triggers like handle_new_user)
CREATE POLICY "Only service role can insert roles"
ON public.user_roles
FOR INSERT
WITH CHECK (
  -- Only allow if called from service role context (triggers use SECURITY DEFINER)
  -- Regular authenticated users cannot insert
  auth.uid() IS NULL OR has_role(auth.uid(), 'admin'::app_role)
);

-- 4. Create UPDATE policy (admins only)
CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create DELETE policy (admins only)
CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));