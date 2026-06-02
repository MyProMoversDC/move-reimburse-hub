# Speed up chat file uploads & downloads

Goal: bring chat file transfers from minutes down to seconds by removing per-file round-trips, shrinking payloads, and caching signed URLs. No backend/plan upgrade required — the bottlenecks are in the app code, not Supabase CPU.

## Root causes (today)

1. **Per-file signed URL round-trips** — `getSignedUrlsForAttachments` (src/lib/storageUtils.ts) calls `createSignedUrl` once per attachment. For a media library with 30 files, that's 30 sequential network requests.
2. **No caching** — every time the chat or Manage Group dialog opens, signed URLs are regenerated from scratch (even though they're valid for 1 hour).
3. **Full-size originals everywhere** — image grids and inline chat images load the full uploaded file. A 6 MB phone photo is downloaded just to render a 96 px thumbnail.
4. **No client-side compression on upload** — phones upload 4–10 MB photos as-is. Upload time is dominated by raw bytes.
5. **Downloads open a new signed URL request per click** — adds 300–800 ms before the browser even starts the download.

## Changes

### 1. Batch signed URL generation
- In `src/lib/storageUtils.ts`, add `getSignedUrlsBatch(bucket, paths[], expiresIn)` that calls `supabase.storage.from(bucket).createSignedUrls(paths, expiresIn)` (single request for N files).
- Rewrite `getSignedUrlsForAttachments` to use the batch call instead of `Promise.all` of individual calls.
- Update callers: `ChatInterface`, `ChatContainer`, `ManageGroupDialog`, plus any other media-listing component using the helper.

### 2. In-memory signed URL cache
- Add a small module `src/lib/signedUrlCache.ts` keyed by `${bucket}:${path}` storing `{ url, expiresAt }`.
- `getSignedUrl` / `getSignedUrlsBatch` check the cache first and only request URLs that are missing or expire within 5 minutes.
- Cache lives for the tab session (no persistence needed).

### 3. Client-side image compression on upload
- Add a `src/lib/imageCompression.ts` helper using browser Canvas: if the file is an image > 1.5 MB, downscale longest edge to 1920 px and re-encode as JPEG at 0.82 quality before upload.
- Apply in chat upload paths (`ChatInterface` / `ChatContainer` upload handlers). Skip for non-images, GIFs, and files already small enough.
- Typical effect: 6 MB phone photo → ~400 KB, ~15× faster upload, visually identical for chat.

### 4. Thumbnail strategy for media grids
- Two options — pick one in build step:
  - **A. Generate a thumbnail on upload** (preferred): create a second small image (max 400 px, JPEG q 0.7) in the same client-side step, upload it alongside the original as `<path>.thumb.jpg`, store both URLs on the attachment row (add `thumb_url text` column to `chat_message_attachments`).
  - **B. On-the-fly transforms** if Supabase image transformations are enabled on the project: append `?width=400&quality=70` to the signed URL for grid previews and keep originals for full-screen view.
- Media grid and inline chat image previews use the thumbnail URL; clicking opens the full original.

### 5. Pre-sign download URLs, don't re-request on click
- When the media list loads, the batch-signed URLs are already valid for an hour — wire the Download button to use that URL directly (no extra `createSignedUrl` call on click). Use `<a href download>` so the browser starts the transfer instantly.

### 6. Parallelize multi-file downloads
- "Download all" (if/where present) should trigger downloads in parallel via hidden anchor clicks rather than sequentially awaiting each.

## Files touched

- `src/lib/storageUtils.ts` — batch helper, cache integration
- `src/lib/signedUrlCache.ts` — new
- `src/lib/imageCompression.ts` — new
- `src/components/dashboard/chat/ChatInterface.tsx` — compress on upload, use cached URLs, use thumb for previews
- `src/components/dashboard/chat/ChatContainer.tsx` — same upload + URL changes
- `src/components/dashboard/chat/ManageGroupDialog.tsx` — batch signed URLs in media tab, use thumb for grid, direct-download anchors
- `supabase/migrations/<timestamp>_add_thumb_url.sql` — add `thumb_url text` to `chat_message_attachments` (only if going with Option A)

## What this does NOT change

- No change to RLS, buckets, or chat data model beyond the optional `thumb_url` column.
- No change to non-chat upload flows (reimbursements, HR docs, etc.) — same helpers can be adopted later but are out of scope here.
- No Supabase plan upgrade needed.

## Decision needed

For thumbnails (step 4), pick:
- **A — generate-on-upload thumbnails** (works on any plan, adds a tiny DB column, deterministic)
- **B — Supabase image transformations** (no schema change, requires the transformation add-on enabled on the project)

I'll default to **A** unless you say otherwise.

## Expected impact

- Opening a group's media tab with 30 files: ~30 requests → 1 request.
- Sending a phone photo: 5–10 s → under 1 s on typical 4G.
- Loading a chat with image previews: full originals → ~30–50 KB thumbnails each.
- Clicking download: no pre-request latency.