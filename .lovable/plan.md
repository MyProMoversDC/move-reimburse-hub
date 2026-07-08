## Goal

When any non-admin cabinet submits a form, every user with the `admin` role receives an iOS/Android push notification. Push infrastructure already works — this only adds new triggers that call the existing dispatcher. No existing rules, tables, or flows change.

## Design

Reuse the exact same pattern already used by `dispatch_push_on_notification` (which fires on `mover_notifications`): a Postgres AFTER INSERT trigger calls `net.http_post` against the existing `send-push-notification` edge function, once per admin user_id.

Everything is additive:
- No changes to `send-push-notification` (already accepts `{ user_id, title, body, data }`).
- No changes to `device_tokens`, `mover_notifications`, or existing triggers.
- No new tables (user chose "Push only").
- No frontend changes.

## Migration — single migration file

### 1. Shared helper

```sql
CREATE OR REPLACE FUNCTION public.push_admins_on_submission(
  _title text,
  _body text,
  _data jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, net
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT user_id FROM public.user_roles WHERE role = 'admin'::app_role LOOP
    BEGIN
      PERFORM net.http_post(
        url := 'https://qunbwlsgjrhayeqhgyce.supabase.co/functions/v1/send-push-notification',
        headers := jsonb_build_object('Content-Type','application/json'),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'title', _title,
          'body', _body,
          'data', _data,
          'source', 'admin_submission_alert'
        )
      );
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'push_admins_on_submission failed for admin %: % (%)', r.user_id, SQLERRM, SQLSTATE;
    END;
  END LOOP;
END $$;
```

Failure inside the loop is swallowed per-admin so a bad token can never break a form submission.

### 2. Per-table trigger functions + AFTER INSERT triggers

One tiny trigger function per table. Each just calls the helper with a table-specific title/body/data payload. Payload `data` includes `reference_type` and `reference_id` so the existing `notificationRouter` deep-links the admin to the right screen when they tap the push.

Tables covered (all "non-admin cabinet" form submissions):

| Table | Title (EN) | reference_type |
|---|---|---|
| `reimbursements` (INSERT) | "New Reimbursement Submitted" | `reimbursement` |
| `reimbursements` (UPDATE when `appeal_count` increases) | "Reimbursement Appeal Filed" | `reimbursement` |
| `review_bonuses` (INSERT) | "New Review Bonus Submitted" | `review_bonus` |
| `review_bonuses` (UPDATE when `appeal_count` increases) | "Review Bonus Appeal Filed" | `review_bonus` |
| `missing_payments` (INSERT) | "New Missing Payment Reported" | `missing_payment` |
| `missing_payments` (UPDATE when `appeal_count` increases) | "Missing Payment Appeal Filed" | `missing_payment` |
| `customer_refunds` (INSERT) | "New Customer Refund Submitted" | `customer_refund` |
| `performance_reports` (INSERT) | "New Misconduct Report Filed" | `performance_report` |
| `violence_incidents` (INSERT) | "New Violence Incident Reported" | `violence_incident` |
| `payment_questions` (INSERT) | "New Payment Question" | `payment_question` |
| `referral_requests` (INSERT) | "New Referral Submitted" | `referral` |
| `day_off_requests` (INSERT) | "New Day-Off Request" | `day_off` |
| `mover_feedback` (INSERT) | "New Mover Suggestion" | `mover_feedback` |

Body text is short and generic (e.g., "Submitted by <first_name> <last_name>" resolved from `profiles` when a `user_id`/`mover_id`/`created_by` column is available; otherwise a fixed string). English only in the push text itself — matches the existing `send-critical-score-alert` / test-push behavior and keeps this iteration small; per-admin locale can be added later without schema changes.

Skeleton (one shown, others follow the same shape):

```sql
CREATE OR REPLACE FUNCTION public.trg_admin_push_reimbursement_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_name text;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(first_name||' '||last_name),''), 'A mover')
    INTO v_name FROM public.profiles WHERE id = NEW.mover_id;
  PERFORM public.push_admins_on_submission(
    'New Reimbursement Submitted',
    v_name || ' submitted reimbursement #' || COALESCE(NEW.reimbursement_number,''),
    jsonb_build_object('reference_type','reimbursement','reference_id', NEW.id,
                       'notification_type','admin_new_submission')
  );
  RETURN NEW;
END $$;

CREATE TRIGGER admin_push_on_reimbursement_insert
AFTER INSERT ON public.reimbursements
FOR EACH ROW EXECUTE FUNCTION public.trg_admin_push_reimbursement_insert();
```

Appeal triggers use `AFTER UPDATE` guarded by `WHEN (OLD.appeal_count IS DISTINCT FROM NEW.appeal_count AND COALESCE(NEW.appeal_count,0) > COALESCE(OLD.appeal_count,0))`.

### 3. Safety guarantees

- All triggers `SECURITY DEFINER` with `SET search_path = public` (matches project pattern).
- Any HTTP failure is caught inside `push_admins_on_submission`; the INSERT/UPDATE that triggered it always succeeds.
- No trigger reads or modifies data outside its own row + `user_roles`/`profiles`, so no RLS / recursion risk.
- No existing trigger or function is dropped or altered.

## Client / iOS side

Nothing to change. Existing iOS APNs setup, `usePushNotifications`, `notificationRouter`, and `device_tokens` handling all remain untouched. The push arrives with `data.reference_type` / `data.reference_id`, and the already-shipped router opens the correct admin screen on tap.

## Verification

1. As an admin on iOS: submit a reimbursement from a mover test account → admin device receives the push.
2. Repeat for one entry per table above (spot-check reimbursement, review bonus, missing payment, misconduct, violence incident, refund).
3. Confirm existing mover_notifications push flow still works unchanged.
4. Confirm submissions still succeed if push service is unreachable (temporarily point helper at bad URL, submit — the row must still insert; log shows a WARNING).
