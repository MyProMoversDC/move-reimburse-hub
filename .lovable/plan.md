## Problem

Declining (and approving) a review bonus fails with:
`invalid input value for enum review_bonus_status: "approved"`

## Root cause

The DB trigger `trg_review_bonus_rating` on `public.review_bonuses` compares the status column to the literal `'approved'`:

```sql
IF NEW.status = 'approved' THEN ...
```

But the `review_bonus_status` enum only has: `pending`, `confirmed`, `declined`, `appeal` — there is no `approved` value. Postgres casts the literal to the enum type and throws on every UPDATE to the table, blocking decline and approve.

The app uses `'confirmed'` as the "approved" status (see `AdminReviewBonusList.tsx` line 201).

## Fix

Migration to recreate `trg_review_bonus_rating()` comparing against the real enum value `'confirmed'`, and update the rating-event description to read "Review bonus approved" (project standard wording stays "Approved"):

```sql
CREATE OR REPLACE FUNCTION public.trg_review_bonus_rating()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.mover_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE'
     AND OLD.status IS DISTINCT FROM NEW.status
     AND NEW.status = 'confirmed'::review_bonus_status THEN
    PERFORM public.apply_rating_event(
      NEW.mover_id, 'review_bonus_approved', 2,
      'Review bonus approved (invoice ' || COALESCE(NEW.invoice_number,'') || ')',
      NEW.id, 'review_bonuses', NULL);
  END IF;
  RETURN NEW;
END;$$;
```

No code or UI changes needed. Approve and Decline will both work again after the migration.