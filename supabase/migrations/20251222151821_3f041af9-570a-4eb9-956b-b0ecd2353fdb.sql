-- Add reviews_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'reviews_admin';

-- Add appeal status to reimbursement_status enum
ALTER TYPE public.reimbursement_status ADD VALUE IF NOT EXISTS 'appeal';

-- Add appeal status to review_bonus_status enum  
ALTER TYPE public.review_bonus_status ADD VALUE IF NOT EXISTS 'appeal';