-- Fix profiles table RLS policies: Change from RESTRICTIVE to PERMISSIVE
-- This ensures ANY matching policy grants access (OR logic) instead of ALL policies must pass (AND logic)

-- Drop existing RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accountants can view all profiles" ON public.profiles;

-- Create new PERMISSIVE SELECT policies with explicit authenticated role requirement
-- PERMISSIVE is the default, but we explicitly target authenticated users only

CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'accountant'::app_role));