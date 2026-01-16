-- Add reviewed_at column to alcohol_test_reports to track when a report has been reviewed
ALTER TABLE public.alcohol_test_reports
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add reviewed_at column to performance_reports to track when a report has been reviewed
ALTER TABLE public.performance_reports
ADD COLUMN reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;