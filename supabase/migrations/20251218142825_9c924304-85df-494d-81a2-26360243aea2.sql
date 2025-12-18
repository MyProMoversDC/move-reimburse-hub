-- Fix security issues: Recreate RLS policies as PERMISSIVE with proper auth checks

-- ============================================
-- PROFILES TABLE - Fix public exposure
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Accountants can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Ensure RLS is enabled
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too (prevents bypassing)
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;

-- Create new PERMISSIVE policies with explicit auth checks
CREATE POLICY "Users can view their own profile"
ON public.profiles FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- ============================================
-- REIMBURSEMENTS TABLE - Fix public exposure
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Accountants can update reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Accountants can view all reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can delete reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can update reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Admins can view all reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Movers can insert their own reimbursements" ON public.reimbursements;
DROP POLICY IF EXISTS "Movers can view their own reimbursements" ON public.reimbursements;

-- Ensure RLS is enabled
ALTER TABLE public.reimbursements ENABLE ROW LEVEL SECURITY;

-- Force RLS for table owner too
ALTER TABLE public.reimbursements FORCE ROW LEVEL SECURITY;

-- Create new PERMISSIVE policies with explicit auth checks
CREATE POLICY "Movers can view their own reimbursements"
ON public.reimbursements FOR SELECT
TO authenticated
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all reimbursements"
ON public.reimbursements FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all reimbursements"
ON public.reimbursements FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Movers can insert their own reimbursements"
ON public.reimbursements FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Admins can update reimbursements"
ON public.reimbursements FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can update reimbursements"
ON public.reimbursements FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Admins can delete reimbursements"
ON public.reimbursements FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- Also fix other sensitive tables
-- ============================================

-- USER_ROLES TABLE
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can delete roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only admins can update roles" ON public.user_roles;
DROP POLICY IF EXISTS "Only service role can insert roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

ALTER TABLE public.user_roles FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- REVIEW_BONUSES TABLE
DROP POLICY IF EXISTS "Admins can update review bonuses" ON public.review_bonuses;
DROP POLICY IF EXISTS "Admins can view all review bonuses" ON public.review_bonuses;
DROP POLICY IF EXISTS "Movers can insert their own review bonuses" ON public.review_bonuses;
DROP POLICY IF EXISTS "Movers can view their own review bonuses" ON public.review_bonuses;

ALTER TABLE public.review_bonuses FORCE ROW LEVEL SECURITY;

CREATE POLICY "Movers can view their own review bonuses"
ON public.review_bonuses FOR SELECT
TO authenticated
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all review bonuses"
ON public.review_bonuses FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Movers can insert their own review bonuses"
ON public.review_bonuses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Admins can update review bonuses"
ON public.review_bonuses FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- REIMBURSEMENT_ATTACHMENTS TABLE
DROP POLICY IF EXISTS "Accountants can view all attachments" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "Admins can delete attachments" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "Admins can view all attachments" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "Users can insert attachments for their reimbursements" ON public.reimbursement_attachments;
DROP POLICY IF EXISTS "Users can view attachments for their reimbursements" ON public.reimbursement_attachments;

ALTER TABLE public.reimbursement_attachments FORCE ROW LEVEL SECURITY;

CREATE POLICY "Users can view attachments for their reimbursements"
ON public.reimbursement_attachments FOR SELECT
TO authenticated
USING (EXISTS (
  SELECT 1 FROM reimbursements
  WHERE reimbursements.id = reimbursement_attachments.reimbursement_id
  AND reimbursements.mover_id = auth.uid()
));

CREATE POLICY "Admins can view all attachments"
ON public.reimbursement_attachments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Accountants can view all attachments"
ON public.reimbursement_attachments FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'accountant'::app_role));

CREATE POLICY "Users can insert attachments for their reimbursements"
ON public.reimbursement_attachments FOR INSERT
TO authenticated
WITH CHECK (EXISTS (
  SELECT 1 FROM reimbursements
  WHERE reimbursements.id = reimbursement_attachments.reimbursement_id
  AND reimbursements.mover_id = auth.uid()
));

CREATE POLICY "Admins can delete attachments"
ON public.reimbursement_attachments FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));