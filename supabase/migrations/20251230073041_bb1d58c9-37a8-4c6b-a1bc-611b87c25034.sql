-- Add appeal_count column to review_bonuses table
ALTER TABLE public.review_bonuses 
ADD COLUMN IF NOT EXISTS appeal_count integer DEFAULT 0;

-- Add appeal_count column to reimbursements table
ALTER TABLE public.reimbursements 
ADD COLUMN IF NOT EXISTS appeal_count integer DEFAULT 0;

-- Add appeal_count column to missing_payments table
ALTER TABLE public.missing_payments 
ADD COLUMN IF NOT EXISTS appeal_count integer DEFAULT 0;