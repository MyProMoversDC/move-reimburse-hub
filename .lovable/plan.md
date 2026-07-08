
# Isolation experiment — remove apns-collapse-id for chat only

## Goal
Determine whether APNs is silently coalescing/suppressing chat pushes because every message in a conversation reuses the same `apns-collapse-id`. Change nothing else.

## Scope
Edit only `supabase/functions/send-push-notification/index.ts`, inside `sendFcm(...)`. No client, native, DB, or Android changes.

## Exact changes

1. Stop emitting `apns-collapse-id` even when the caller passes `apns_thread_id`. `apnsHeaders` becomes:
   ```
   { "apns-priority": "10", "apns-push-type": "alert" }
   ```
   `apns-push-type` is added unconditionally for every push so APNs never has to infer it (iOS 13+ requires this header; FCM normally injects it, but adding it explicitly removes any ambiguity introduced by our custom header map).

2. Keep `aps["thread-id"] = opts.apnsThreadId` when provided. This only groups notifications in Notification Center; it does not coalesce or replace.

3. Leave everything else untouched:
   - `aps.alert`, `sound: "default"`, `mutable-content: 1`, `content-available: 1`
   - `apns-priority: "10"`
   - `android.priority: "HIGH"` and `android.collapse_key`
   - Token lookup, invalid-token cleanup, admin test path, `mover_notifications` payload

Because the only field consumed differently for chat vs `mover_notifications` was `apns-collapse-id` (chat set it, other sources didn't), removing it makes chat pushes structurally identical to the working `mover_notifications` payload except for the harmless `thread-id`. That is the minimum surface area needed to prove or disprove collapse-based suppression.

## Why nothing else changes

- `content-available: 1`, priority 10, and `mutable-content: 1` are shared with the working `mover_notifications` path, so they cannot be the differentiator.
- Android is unaffected because `android.collapse_key` is a separate FCM field and Android pushes already work.
- The DB trigger keeps sending `apns_thread_id`; the edge function simply stops promoting it to a collapse header. No migration needed, no other caller impacted.
- Client-side handlers read `data.reference_type` / `data.reference_id`, which are unchanged.

## How to verify after deploy

1. Send a chat message to an iOS TestFlight recipient who is NOT actively viewing the conversation.
2. Confirm banner appears on device.
3. Send a second chat message in the same conversation within a few seconds; confirm both notifications appear separately (no collapse).
4. Send a `mover_notifications` push in parallel to confirm no regression on the working path.
5. Check `net._http_response` for `sent:1` and `send-push-notification` logs for no new errors.

If banners appear: APNs collapse behavior was the cause — proceed to design final chat-collapse strategy.
If banners still do not appear: eliminate collapse-id as the suspect and move to the next hypothesis (priority/content-available mismatch or `apns-push-type` routing).
