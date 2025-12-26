-- Add hourly_rate to profiles table
ALTER TABLE public.profiles 
ADD COLUMN hourly_rate numeric DEFAULT 0;

-- Create mover_balances table to track balance
CREATE TABLE public.mover_balances (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id uuid NOT NULL UNIQUE,
  balance numeric NOT NULL DEFAULT 0,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on mover_balances
ALTER TABLE public.mover_balances ENABLE ROW LEVEL SECURITY;

-- RLS policies for mover_balances
CREATE POLICY "Movers can view their own balance"
ON public.mover_balances
FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all balances"
ON public.mover_balances
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update balances"
ON public.mover_balances
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert balances"
ON public.mover_balances
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reviews admins can view all balances"
ON public.mover_balances
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

CREATE POLICY "Reviews admins can update balances"
ON public.mover_balances
FOR UPDATE
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

CREATE POLICY "Reviews admins can insert balances"
ON public.mover_balances
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Create mover_bonus_transactions table to track bonus history
CREATE TABLE public.mover_bonus_transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  mover_id uuid NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL CHECK (transaction_type IN ('bonus', 'deductible')),
  description text,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  reference_id uuid,
  reference_type text
);

-- Enable RLS on mover_bonus_transactions
ALTER TABLE public.mover_bonus_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for mover_bonus_transactions
CREATE POLICY "Movers can view their own transactions"
ON public.mover_bonus_transactions
FOR SELECT
USING (auth.uid() = mover_id);

CREATE POLICY "Admins can view all transactions"
ON public.mover_bonus_transactions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert transactions"
ON public.mover_bonus_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Reviews admins can view all transactions"
ON public.mover_bonus_transactions
FOR SELECT
USING (has_role(auth.uid(), 'reviews_admin'::app_role));

CREATE POLICY "Reviews admins can insert transactions"
ON public.mover_bonus_transactions
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'reviews_admin'::app_role));

-- Create function to update mover balance when transaction is added
CREATE OR REPLACE FUNCTION public.update_mover_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the balance record
  INSERT INTO public.mover_balances (mover_id, balance, updated_at)
  VALUES (
    NEW.mover_id,
    CASE WHEN NEW.transaction_type = 'bonus' THEN NEW.amount ELSE -NEW.amount END,
    now()
  )
  ON CONFLICT (mover_id)
  DO UPDATE SET
    balance = mover_balances.balance + CASE WHEN NEW.transaction_type = 'bonus' THEN NEW.amount ELSE -NEW.amount END,
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-update balance on transaction insert
CREATE TRIGGER update_balance_on_transaction
AFTER INSERT ON public.mover_bonus_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_mover_balance();

-- Also update balance when deductibles are added
CREATE OR REPLACE FUNCTION public.update_balance_on_deductible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert or update the balance record (deduct the amount)
  INSERT INTO public.mover_balances (mover_id, balance, updated_at)
  VALUES (NEW.mover_id, -NEW.amount, now())
  ON CONFLICT (mover_id)
  DO UPDATE SET
    balance = mover_balances.balance - NEW.amount,
    updated_at = now();
  
  -- Also create a transaction record
  INSERT INTO public.mover_bonus_transactions (mover_id, amount, transaction_type, description, created_by, reference_id, reference_type)
  VALUES (NEW.mover_id, NEW.amount, 'deductible', NEW.reason, NEW.created_by, NEW.id, 'deductible');
  
  RETURN NEW;
END;
$$;

-- Create trigger for deductibles
CREATE TRIGGER update_balance_on_deductible_insert
AFTER INSERT ON public.deductibles
FOR EACH ROW
EXECUTE FUNCTION public.update_balance_on_deductible();

-- Create function to revert balance on deductible delete
CREATE OR REPLACE FUNCTION public.revert_balance_on_deductible_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Revert the balance (add back the deducted amount)
  UPDATE public.mover_balances
  SET balance = balance + OLD.amount,
      updated_at = now()
  WHERE mover_id = OLD.mover_id;
  
  RETURN OLD;
END;
$$;

-- Create trigger for deductible deletion
CREATE TRIGGER revert_balance_on_deductible_delete
BEFORE DELETE ON public.deductibles
FOR EACH ROW
EXECUTE FUNCTION public.revert_balance_on_deductible_delete();