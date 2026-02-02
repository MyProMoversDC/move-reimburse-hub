-- Create function to check for duplicate invoice number (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_duplicate_invoice_number(p_invoice_number text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_bonuses
    WHERE invoice_number = p_invoice_number
  );
$$;

-- Create function to check for duplicate review URL (bypasses RLS)
CREATE OR REPLACE FUNCTION public.check_duplicate_review_url(p_review_url text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.review_bonuses
    WHERE review_url = p_review_url
  );
$$;