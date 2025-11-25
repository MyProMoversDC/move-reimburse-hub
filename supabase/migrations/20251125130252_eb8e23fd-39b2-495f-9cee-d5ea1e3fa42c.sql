-- Create a function to look up email by username (for login purposes only)
-- This is secure because it only returns the email, not other sensitive data
CREATE OR REPLACE FUNCTION public.get_email_by_username(input_username text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles WHERE username = input_username LIMIT 1;
$$;