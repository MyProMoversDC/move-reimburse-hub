-- Add taken_actions column to performance_reports table
ALTER TABLE public.performance_reports 
ADD COLUMN taken_actions text;