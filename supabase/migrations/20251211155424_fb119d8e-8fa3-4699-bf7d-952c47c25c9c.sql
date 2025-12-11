-- Add decline_reason column to reimbursements table
ALTER TABLE public.reimbursements ADD COLUMN decline_reason text;