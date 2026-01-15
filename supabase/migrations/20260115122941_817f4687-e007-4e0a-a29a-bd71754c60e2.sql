
-- Create alcohol test reports table
CREATE TABLE public.alcohol_test_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Section 2: Test Details
  test_date DATE NOT NULL,
  test_time TIME NOT NULL,
  test_location TEXT NOT NULL,
  test_type TEXT NOT NULL,
  test_type_other_explanation TEXT,
  
  -- Section 3: Tester Information
  tester_id UUID NOT NULL,
  tester_name TEXT NOT NULL,
  tester_job_title TEXT NOT NULL,
  tester_confirmed_administered BOOLEAN NOT NULL DEFAULT false,
  
  -- Section 4: Worker Being Tested
  worker_id UUID NOT NULL,
  worker_name TEXT NOT NULL,
  worker_classification TEXT NOT NULL,
  worker_role TEXT NOT NULL,
  test_timing TEXT NOT NULL,
  
  -- Section 5: Test Conditions
  worker_confirmed_no_consumption BOOLEAN NOT NULL DEFAULT false,
  waiting_period_observed BOOLEAN NOT NULL DEFAULT false,
  
  -- Section 6: BAC Results
  bac_reading_first NUMERIC(4,3) NOT NULL,
  second_test_required BOOLEAN NOT NULL DEFAULT false,
  bac_reading_second NUMERIC(4,3),
  final_result TEXT NOT NULL,
  
  -- Section 7: Photo
  photo_url TEXT NOT NULL,
  photo_file_name TEXT NOT NULL,
  
  -- Section 8: Action Taken
  actions_taken TEXT[] NOT NULL,
  additional_notes TEXT,
  
  -- SOP Acknowledgment
  sop_acknowledged BOOLEAN NOT NULL DEFAULT false
);

-- Enable RLS
ALTER TABLE public.alcohol_test_reports ENABLE ROW LEVEL SECURITY;

-- Operations managers can insert their own reports
CREATE POLICY "Operations managers can insert alcohol test reports"
ON public.alcohol_test_reports
FOR INSERT
WITH CHECK (
  auth.uid() = tester_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'operations_manager'
  )
);

-- Operations managers can view their own reports
CREATE POLICY "Operations managers can view own alcohol test reports"
ON public.alcohol_test_reports
FOR SELECT
USING (
  auth.uid() = tester_id AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'operations_manager'
  )
);

-- Admins and HR can view all reports
CREATE POLICY "Admin and HR can view all alcohol test reports"
ON public.alcohol_test_reports
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr_manager')
  )
);

-- Create storage bucket for alcohol test photos
INSERT INTO storage.buckets (id, name, public) 
VALUES ('alcohol-test-photos', 'alcohol-test-photos', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for alcohol test photos
CREATE POLICY "Operations managers can upload alcohol test photos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'alcohol-test-photos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'operations_manager'
  )
);

CREATE POLICY "Authorized users can view alcohol test photos"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'alcohol-test-photos' AND
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'hr_manager', 'operations_manager')
  )
);
