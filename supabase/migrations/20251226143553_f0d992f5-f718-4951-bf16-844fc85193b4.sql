-- Fix double-deduction bug: The deductible trigger was inserting a transaction,
-- which then triggered the transaction trigger to also update the balance.
-- Solution: Don't update balance in the deductible trigger, let the transaction trigger handle it.

CREATE OR REPLACE FUNCTION public.update_balance_on_deductible()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only create a transaction record - the transaction trigger will handle the balance update
  INSERT INTO public.mover_bonus_transactions (mover_id, amount, transaction_type, description, created_by, reference_id, reference_type)
  VALUES (NEW.mover_id, NEW.amount, 'deductible', NEW.reason, NEW.created_by, NEW.id, 'deductible');
  
  RETURN NEW;
END;
$$;