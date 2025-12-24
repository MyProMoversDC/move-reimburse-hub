-- Create enum for missing payment status
CREATE TYPE public.missing_payment_status AS ENUM ('pending', 'confirmed', 'declined', 'appeal');

-- Create enum for discrepancy types
CREATE TYPE public.discrepancy_type AS ENUM ('missing_hours', 'incorrect_hourly_rate', 'missing_tip', 'missing_bonus', 'other');

-- Create missing_payments table
CREATE TABLE public.missing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mover_id UUID NOT NULL,
    mover_full_name TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    job_number TEXT NOT NULL,
    discrepancy_date DATE NOT NULL,
    discrepancy_types discrepancy_type[] NOT NULL,
    discrepancy_details TEXT NOT NULL,
    missing_amount TEXT NOT NULL,
    status missing_payment_status NOT NULL DEFAULT 'pending',
    decline_reason TEXT,
    appeal_note TEXT,
    appeal_at TIMESTAMP WITH TIME ZONE,
    reviewed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.missing_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for missing_payments
CREATE POLICY "Movers can view their own missing payments"
ON public.missing_payments
FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Movers can insert their own missing payments"
ON public.missing_payments
FOR INSERT
WITH CHECK (auth.uid() = mover_id);

CREATE POLICY "Movers can update their own declined missing payments to appeal"
ON public.missing_payments
FOR UPDATE
USING (auth.uid() = mover_id AND status = 'declined')
WITH CHECK (auth.uid() = mover_id AND status = 'appeal');

CREATE POLICY "Admins can view all missing payments"
ON public.missing_payments
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update missing payments"
ON public.missing_payments
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Reviews admins can view all missing payments"
ON public.missing_payments
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'));

CREATE POLICY "Reviews admins can update missing payments"
ON public.missing_payments
FOR UPDATE
USING (has_role(auth.uid(), 'reviews_admin'));