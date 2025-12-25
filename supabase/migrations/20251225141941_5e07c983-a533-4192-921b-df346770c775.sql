-- Create deductibles table
CREATE TABLE public.deductibles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.performance_reports(id) ON DELETE SET NULL,
  mover_id UUID NOT NULL,
  mover_name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  reason TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.deductibles ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins can view all deductibles"
ON public.deductibles
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert deductibles"
ON public.deductibles
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update deductibles"
ON public.deductibles
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete deductibles"
ON public.deductibles
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Reviews admins can view deductibles
CREATE POLICY "Reviews admins can view all deductibles"
ON public.deductibles
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Movers can view their own deductibles
CREATE POLICY "Movers can view their own deductibles"
ON public.deductibles
FOR SELECT
USING (auth.uid() = mover_id);