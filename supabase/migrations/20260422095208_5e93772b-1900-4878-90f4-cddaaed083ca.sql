CREATE TABLE public.checkr_candidates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  checkr_candidate_id TEXT,
  invitation_id TEXT,
  invitation_url TEXT,
  report_id TEXT,
  status TEXT NOT NULL DEFAULT 'invited',
  checkr_result TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.checkr_candidates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all checkr candidates"
ON public.checkr_candidates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own checkr record"
ON public.checkr_candidates
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert checkr candidates"
ON public.checkr_candidates
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can update checkr candidates"
ON public.checkr_candidates
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_checkr_candidates_updated_at
BEFORE UPDATE ON public.checkr_candidates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();