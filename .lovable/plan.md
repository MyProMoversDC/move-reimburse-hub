# Make chat uploads truly fast (3-layer plan)

Your symptom — **6 images = 5 minutes** — is about 50 s/file. The previous round added image compression, but it only triggers above 1.5 MB and outputs at q 0.82 / 1920 px. If a phone photo is 3 MB raw it shrinks to ~500 KB, and 6 × 500 KB on a 2 Mbps mobile upload is ~12 s, not 5 min. So something else is dominating:

- Compression may not be running on mobile (Safari/Chrome canvas can silently fall back).
- Files might be HEIC or very large screenshots that bypass our thresholds.
- The Supabase Storage endpoint may be far from the user — every file is a fresh TCP+TLS handshake to one region.
- Uploads happen one TCP stream per file, not chunked.

The plan tackles it in three layers. Each layer is independently deployable and you can stop at any layer that solves the problem.

---

## Layer 1 — Diagnose & squeeze the free fixes (do first, no cost)

Goal: confirm what's actually slow before paying for anything.

1. **Per-file upload progress + timing UI** in chat input. Show "2.1 MB → 380 KB · uploading 38%". Logs to console too. This alone will tell us where the time goes.
2. **More aggressive image compression**:
   - Threshold drops from 1.5 MB → 500 KB.
   - Max edge drops from 1920 → 1400 px (still sharp on phones).
   - Quality drops from 0.82 → 0.75.
   - WebP output when supported (~25-35% smaller than JPEG at same quality).
3. **HEIC handling**: iPhone photos shared via "Files" can arrive as HEIC. Detect and convert to JPEG with `heic2any` (lazy-loaded only when needed).
4. **Hard cap on raw video size**: if a video is > 25 MB, reject with a clear message asking the user to trim it, since browser video transcoding is too slow.
5. **Truly parallel uploads with concurrency limit of 4**: avoids overwhelming mobile radios while still using multiple TCP streams.
6. **Pre-create the message + insert attachments incrementally** as each upload finishes, so users see images appear one by one instead of all-at-once at the end.

**Files**: `src/lib/imageCompression.ts`, `src/components/dashboard/chat/ChatInterface.tsx`, new `src/lib/uploadQueue.ts`.

Expected result for your 6-image case: **5 min → 20-40 s** on typical mobile.

---

## Layer 2 — AWS S3 + Transfer Acceleration (~$5-10/mo, recommended if Layer 1 isn't enough)

Lovable already has a built-in **AWS S3 connector** with signed-URL upload. We turn on **S3 Transfer Acceleration**, which routes uploads through the nearest Amazon CloudFront edge (300+ PoPs worldwide) before forwarding to the bucket. For a user in Brazil uploading to a US bucket, this often cuts upload time by 50-80%.

Pricing reality:
- S3 storage: $0.023/GB/mo
- Transfer Acceleration: $0.04/GB uploaded (only for upload data)
- For chat-scale usage (~1-5 GB/mo of new uploads), total ≈ **$3-10/mo**.

Architecture:
```text
Client → CloudFront edge (nearest city) → S3 bucket
```

Implementation:
1. User creates an S3 bucket in AWS, enables Transfer Acceleration on it, sets CORS to allow the app origin.
2. Link the AWS S3 connector in Lovable (with `write` scope).
3. New edge function `chat-upload-sign` that returns batched presigned PUT URLs (uses the connector gateway's `sign_storage_url?mode=write`).
4. Client uploads directly to S3 via PUT in parallel (4 at a time), with progress.
5. New edge function `chat-download-sign` for batched presigned GET URLs.
6. `chat_message_attachments` gets two new optional columns: `storage_provider` ('supabase' | 's3') and `s3_key`. Old Supabase-backed attachments keep working unchanged.
7. New uploads go to S3; reads check `storage_provider` and call the right signer.

**Files**: new edge functions `supabase/functions/chat-upload-sign/index.ts`, `supabase/functions/chat-download-sign/index.ts`, migration to add the columns, `src/lib/chatStorage.ts` to abstract provider, updates to `ChatInterface.tsx` and `ManageGroupDialog.tsx`.

**Setup the user does**: create AWS account (if not already), create bucket, enable Transfer Acceleration, set CORS, click "Connect AWS S3" in Lovable.

---

## Layer 3 — Cloudflare R2 (alternative to Layer 2, cheaper, more setup)

R2 is cheaper than S3 ($0.015/GB storage, **free egress**), uses S3-compatible API, and uploads land at the nearest Cloudflare PoP automatically (no Transfer Acceleration toggle needed). Cost is ~$1-3/mo at your scale.

Trade-off: there is no Lovable connector for R2 yet, so we'd store the R2 credentials as plain secrets (`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`) and sign URLs in an edge function using the `aws4fetch` library. Functionally identical to Layer 2 from the user's perspective.

Pick this over Layer 2 only if you want lower long-term cost and don't want to deal with AWS.

---

## Recommendation

1. Start with **Layer 1** today — it's free, ships in this session, and very likely brings you under 1 minute for 6 photos.
2. If global users still complain, add **Layer 2 (AWS S3 + Transfer Acceleration)**. Lowest-friction since the connector exists.
3. Skip Layer 3 unless you want the cost optimization.

## Decision needed

- Build **Layer 1 now**? (yes/no — I'd default to yes)
- Also start scaffolding **Layer 2** in the same turn, ready to flip on after you create the AWS bucket? Or wait and see if Layer 1 is enough?

## Out of scope

- Existing Supabase-stored attachments are not migrated. They keep working forever via the existing signed-URL path. New uploads go to the new storage if Layer 2/3 is enabled.
- Non-chat uploads (reimbursements, HR docs, etc.) are not changed.
- No DB role/RLS changes beyond two new optional columns on `chat_message_attachments`.