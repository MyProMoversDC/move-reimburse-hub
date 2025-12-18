-- Add unique constraint on invoice_number in review_bonuses table
ALTER TABLE public.review_bonuses ADD CONSTRAINT review_bonuses_invoice_number_unique UNIQUE (invoice_number);