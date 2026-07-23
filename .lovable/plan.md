
# Pay Stub Management — Reviews Admin Cabinet

Adapt the original brief to this stack: cron-driven pull from SmartMoving, auto-send to matched movers, hold unmatched for manual assignment. No manual upload flow, no in-app template editor, no open tracking.

## User-facing behavior

- New "Pay Stubs" tab in the Customer Review Manager (Reviews Admin) cabinet — visible to `reviews_admin` and `admin`.
- Every Thursday at **10:00 AM EST**, the system pulls the current week's pay stub PDFs from SmartMoving.
- Each PDF is stored, matched to a mover by SmartMoving employee ID → `profiles`.
- **Matched rows** are queued and emailed automatically with the pay stub PDF attached, using a 10–15s random cooldown per email.
- **Unmatched rows** stay in a review table where the Reviews Admin can:
  - Assign the correct mover from a dropdown (existing `SearchableSelect`, movers only).
  - Preview the rendered email.
  - Click **Send** to release the queued email.
  - Or **Discard** the row if it doesn't apply.
- Batch view shows: filename, extracted name, matched mover, pay period, net amount, status badge (`processing / ready / unmatched / sent / send_failed / discarded`), sent timestamp (EST), sent-by.
- All sends write to the existing `email_logs` table plus a dedicated `pay_stub_send_log` for audit ("who told which person what, when").

## Data model (new tables in `public`)

Each table gets `GRANT` + RLS in the same migration, restricted to `admin` + `reviews_admin` via `has_role()`. `service_role` full access for the edge function.

- `pay_stub_batches` — one row per weekly cron run. Fields: `run_date` (EST date), `source` (`smartmoving_cron` / `smartmoving_manual`), `status`, `created_by` (nullable for cron), totals.
- `pay_stubs` — one row per PDF. Fields: `batch_id`, `file_path` (private storage), `smartmoving_employee_id`, `extracted_name`, `mover_id` (nullable), `pay_period_start`, `pay_period_end`, `net_total` (numeric), `status`, `error`, `sent_at`, `sent_by`, `discarded_at`, `discarded_by`.
- `pay_stub_send_log` — append-only audit. Fields: `pay_stub_id`, `mover_id`, `email`, `sent_at`, `status`, `error`, `sent_by`.

Storage: new **private** bucket `pay-stubs` with signed URLs (per existing "Secure Attachment Logic" memory). Objects keyed `batches/{batch_id}/{pay_stub_id}.pdf`.

## Edge functions (new)

1. `sync-smartmoving-paystubs` (`verify_jwt = false`, called only by cron).
   - Discovery step in code: hit SmartMoving's paystub endpoint using the existing SmartMoving API key secret already used by `sync-smartmoving-jobs`. If the endpoint or contract is unknown at build time, function first logs a shape probe and returns a structured error — no partial writes.
   - For each pay stub: upload PDF to `pay-stubs`, parse header for employee id / period / net (fallback to `pdf-parse` via `npm:` specifier if fields aren't in the API payload), insert `pay_stubs` row.
   - Match `smartmoving_employee_id` → `profiles.smartmoving_employee_id`. (If that column doesn't exist yet, migration adds it as nullable — no backfill required; unmatched rows fall through to manual assignment.)
   - Enqueue matched rows into the sender by invoking `send-paystub-batch` with the batch id.

2. `send-paystub-batch` (`verify_jwt = true`).
   - Background async loop: for each `status='ready'` row in the batch, send via **Resend** (existing `RESEND_API_KEY_1` connector per memory), PDF fetched from storage as attachment. 10–15s random sleep between sends. Per-send try/catch — a failed send sets `status='send_failed'` and logs the SMTP error; never marks as sent optimistically. Progress persisted on `pay_stub_batches` for polling.
   - Same function handles single-row sends triggered from the UI (after manual assignment).

3. `record-paystub-send` — small helper invoked from the UI to write audit rows with the authenticated user's id (satisfies "who sent it").

Email body: hardcoded HTML template with `{{mover_name}}`, `{{pay_period}}`, `{{net_amount}}` (EST-formatted), no links/buttons (per Core memory: emails contain no links). Subject: "Your MyProMovers pay stub — {{pay_period}}".

## Cron

```sql
select cron.schedule(
  'smartmoving-paystubs-weekly',
  '0 15 * * 4', -- 10 AM EST = 15 UTC Thursdays (EST, not EDT — see note)
  $$ select net.http_post( ... /sync-smartmoving-paystubs ...) $$
);
```

Note: user specified EST (not "Eastern Time"). Schedule uses fixed EST offset (UTC-5) per project convention. If DST-aware behavior is later desired, the cron expression is the only change needed.

## UI (new components under `src/components/dashboard/paystubs/`)

- `PayStubsDashboard.tsx` — batch selector + summary counts + tabs (All / Matched / Unmatched / Sent / Failed).
- `PayStubBatchTable.tsx` — `ResponsiveCardTable`-based, mobile-friendly, shows every row's status.
- `PayStubAssignDialog.tsx` — `SearchableSelect` of movers (auto-filters admins/accountants per memory), preview of rendered email, "Send now" and "Discard" actions.
- Wire into `ReviewsAdminDashboard.tsx`:
  - Add nav item `{ id: "paystubs", label: ti18n("nav.payStubs"), icon: FileText }`.
  - Add case in `renderContent` + desktop panel.
  - Add `nav.payStubs` + all new UI keys to `en.ts`, `es.ts`, `ru.ts` (per Core i18n rule).
- Red-dot indicator on the nav item while `unmatched` or `send_failed` rows exist for the current batch (matches existing management red-dot pattern per memory).

## Notification & compliance touches

- Reuse existing admin submission push notification pattern only for `send_failed` rows (not for successful cron runs — avoid noise).
- All times displayed in EST via `dateUtils.ts` (per Core rule).
- Every sent email also written to `email_logs` so it appears in the Email Logs cabinet (existing feature).

## Explicitly out of scope (this iteration)

- Manual multi-PDF upload flow.
- In-app WYSIWYG template editor.
- Open-tracking pixel and public `/track/:id.png` endpoint.
- Bulk mover CSV import (movers already live in `profiles`).
- Analytics dashboard beyond the flat filterable batch table.
- Deduction notices / discrepancy reporting.

## Rollout order

1. Migration: `smartmoving_employee_id` column on `profiles`, three new tables + GRANTs + RLS, `pay-stubs` private bucket.
2. Edge functions: `sync-smartmoving-paystubs`, `send-paystub-batch`, `record-paystub-send`.
3. Cron schedule via `supabase--insert` (contains project-specific URL/key, per schedule-jobs guide).
4. UI wiring into Reviews Admin cabinet + i18n keys.
5. Verification: manual invoke of `sync-smartmoving-paystubs` in dev with a small test window before the first Thursday run; confirm unmatched-only path (no auto-sends) if all rows land unmatched.

## Open items to confirm during build (won't block plan approval)

- Exact SmartMoving paystub endpoint / auth shape — will be validated against the existing SmartMoving secret in step 2. If SmartMoving does not expose PDFs the way the user described, I'll surface that immediately and pause rather than pivot to raw-data PDF generation without approval.
- Whether `profiles.smartmoving_employee_id` should be populated automatically from an existing SmartMoving sync or left for admins to fill on the mover profile page — will confirm once the ingestion is working.
