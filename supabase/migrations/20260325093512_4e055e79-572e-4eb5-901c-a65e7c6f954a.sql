
CREATE TABLE public.customer_refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submitted_by uuid NOT NULL,
  customer_name text NOT NULL,
  reimbursement_reason text NOT NULL,
  request_date date NOT NULL,
  amount numeric NOT NULL,
  payment_method text NOT NULL,
  payment_method_other text,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.customer_refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_refunds FORCE ROW LEVEL SECURITY;

CREATE POLICY "Operations managers can insert customer refunds"
  ON public.customer_refunds FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'operations_manager'::app_role) AND auth.uid() = submitted_by);

CREATE POLICY "Operations managers can view their own refunds"
  ON public.customer_refunds FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'operations_manager'::app_role) AND auth.uid() = submitted_by);

CREATE POLICY "Admins can view all customer refunds"
  ON public.customer_refunds FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update customer refunds"
  ON public.customer_refunds FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
