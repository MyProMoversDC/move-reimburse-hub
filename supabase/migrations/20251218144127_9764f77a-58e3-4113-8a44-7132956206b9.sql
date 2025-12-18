-- =====================================================
-- FIX RLS POLICIES FOR profiles AND reimbursements TABLES
-- Change from RESTRICTIVE to PERMISSIVE with explicit authenticated targeting
-- =====================================================

-- Ensure FORCE ROW LEVEL SECURITY is enabled (blocks table owners too)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
ALTER TABLE public.reimbursements FORCE ROW LEVEL SECURITY;

-- =====================================================
-- PROFILES TABLE - Fix SELECT policies
-- =====================================================

-- Drop existing RESTRICTIVE SELECT policies
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Accountants can view all profiles" ON public.profiles;

-- Drop and recreate INSERT/UPDATE policies as PERMISSIVE
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create PERMISSIVE SELECT policies with TO authenticated (blocks anon completely)
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'accountant'::app_role));

-- Recreate INSERT/UPDATE as PERMISSIVE
CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE TO authenticated
USING (auth.uid() = id);

-- =====================================================
-- REIMBURSEMENTS TABLE - Fix ALL policies
-- =====================================================

-- Drop all existing RESTRICTIVE policies
DROP POLICY IF EXISTS "Movers can view their own reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can view all reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Accountants can view all reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Movers can insert their own reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can update reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Accountants can update reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can delete reimbursements" ON public.reimbursements;

-- Create PERMISSIVE SELECT policies
CREATE POLICY "Movers can view their own reimbursements"
ON public.reimbursements FOR SELECT TO authenticated
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all reimbursements"
ON public.reimbursements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all reimbursements"
ON public.reimbursements FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'accountant'::app_role));

-- Create PERMISSIVE INSERT policy
CREATE POLICY "Movers can insert their own reimbursements"
ON public.reimbursements FOR INSERT TO authenticated
WITH CHECK (auth.uid() = mover_id);

-- Create PERMISSIVE UPDATE policies
CREATE POLICY "Admins can update reimbursements"
ON public.reimbursements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can update reimbursements"
ON public.reimbursements FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'accountant'::app_role));

-- Create PERMISSIVE DELETE policy
CREATE POLICY "Admins can delete reimbursements"
ON public.reimbursements FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));