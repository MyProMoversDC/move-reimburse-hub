-- 1. Create consent_documents table for admin-uploaded consent documents
CREATE TABLE public.consent_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  uploaded_by TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create consent_acknowledgments table for mover signatures
CREATE TABLE public.consent_acknowledgments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_document_id UUID NOT NULL REFERENCES public.consent_documents(id),
  acknowledged_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_document_id)
);

-- 2. Create user_activity_logs table
CREATE TABLE public.user_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  activity_type TEXT NOT NULL,
  activity_description TEXT NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 3. Create address_history table for HR to track address changes
CREATE TABLE public.address_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  address TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- 4. Create annual_address_confirmations table
CREATE TABLE public.annual_address_confirmations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  confirmed_year INTEGER NOT NULL,
  address_confirmed TEXT NOT NULL,
  address_changed BOOLEAN NOT NULL DEFAULT false,
  confirmed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, confirmed_year)
);

-- 5. Add medical card date fields to user_driver_status if not exists
ALTER TABLE public.user_driver_status
ADD COLUMN IF NOT EXISTS medical_card_issue_date DATE,
ADD COLUMN IF NOT EXISTS medical_card_expiration_date DATE;

-- 6. Add driver_doc_status for HR review/decline of driver documents
CREATE TABLE public.driver_document_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  document_type TEXT NOT NULL, -- 'drivers_license' or 'medical_card'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'declined'
  decline_reason TEXT,
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consent_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.address_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.annual_address_confirmations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.driver_document_reviews ENABLE ROW LEVEL SECURITY;

-- Consent Documents policies (using correct function signature)
CREATE POLICY "Admins can manage consent documents"
ON public.consent_documents FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can view active consent documents"
ON public.consent_documents FOR SELECT
USING (is_active = true);

-- Consent Acknowledgments policies
CREATE POLICY "Users can view their own consent acknowledgments"
ON public.consent_acknowledgments FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own consent acknowledgments"
ON public.consent_acknowledgments FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all consent acknowledgments"
ON public.consent_acknowledgments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr_manager'::public.app_role));

-- User Activity Logs policies
CREATE POLICY "Admins can view all activity logs"
ON public.user_activity_logs FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Users can insert their own activity logs"
ON public.user_activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Address History policies
CREATE POLICY "HR and Admin can view address history"
ON public.address_history FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr_manager'::public.app_role));

CREATE POLICY "Users can insert their own address history"
ON public.address_history FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Annual Address Confirmations policies
CREATE POLICY "Users can manage their own annual confirmations"
ON public.annual_address_confirmations FOR ALL
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all annual confirmations"
ON public.annual_address_confirmations FOR SELECT
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr_manager'::public.app_role));

-- Driver Document Reviews policies
CREATE POLICY "HR and Admin can manage driver document reviews"
ON public.driver_document_reviews FOR ALL
USING (public.has_role(auth.uid(), 'admin'::public.app_role) OR public.has_role(auth.uid(), 'hr_manager'::public.app_role));

CREATE POLICY "Users can view their own document reviews"
ON public.driver_document_reviews FOR SELECT
USING (auth.uid() = user_id);

-- Create function to log address changes
CREATE OR REPLACE FUNCTION public.log_address_change()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'UPDATE' AND OLD.address IS DISTINCT FROM NEW.address AND NEW.address IS NOT NULL) THEN
    INSERT INTO public.address_history (user_id, address)
    VALUES (NEW.id, NEW.address);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for address history
DROP TRIGGER IF EXISTS track_address_change ON public.profiles;
CREATE TRIGGER track_address_change
AFTER UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.log_address_change();

-- Create indexes for better query performance
CREATE INDEX idx_user_activity_logs_user_id ON public.user_activity_logs(user_id);
CREATE INDEX idx_user_activity_logs_created_at ON public.user_activity_logs(created_at);
CREATE INDEX idx_address_history_user_id ON public.address_history(user_id);
CREATE INDEX idx_driver_document_reviews_user_id ON public.driver_document_reviews(user_id);