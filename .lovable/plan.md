
## 1. New "Application Instructions" system (admin-managed, mover-only)

### Database
- New table `application_instruction_materials`: `title`, `description`, `file_url`, `file_type` (pdf/video/image/other), `file_name`, `file_size`, `sort_order`, `created_by`, timestamps.
  - RLS: admins full CRUD; movers read-only (via `has_role` for admin/hr_manager write, authenticated select).
  - GRANTs for authenticated + service_role.
- New table `application_instruction_completions`: `user_id`, `completed_at`, `last_reminded_at`.
  - Tracks whether a mover has marked training as completed and when they were last nudged.
- New storage bucket `application-instructions` (private, signed URLs).

### Admin cabinet
- New sidebar entry in `AdminSidebar.tsx` (and HR sidebar if requested — default: admin only): **"Application Instructions"**.
- New component `AdminApplicationInstructions.tsx`: upload files/videos with title + description, list, reorder, delete. Mirrors `AdminKnowledgeBase.tsx` styling but simpler (no folders, no role sharing — always mover-visible).

### Mover cabinet
- New sidebar entry in `MoverSidebar.tsx`: **"Application Instructions"** (icon: `BookOpen`) — appears on desktop + mobile bottom drawer.
- New component `MoverApplicationInstructions.tsx`: lists all materials with inline preview (PDF viewer, video player, image), plus a **"I've completed studying"** button that writes to `application_instruction_completions`.
- Red-dot badge on the sidebar entry until completion row exists.

### Onboarding popup (between Handbook and Feed)
- New component `ApplicationInstructionsPopup.tsx`, wired into `MoverDashboard.tsx` sequence:
  `Consent → Handbook → **Application Instructions Popup** → (feed popup only if applicable)`.
- Contents (fully translated EN/ES/RU):
  - Title: "Application Instructions" / "Instrucciones de la Aplicación" / "Инструкции по приложению"
  - High-contrast highlighted disclaimer explaining: please review all uploaded manuals and videos to learn the app.
  - Two buttons:
    - **"Go to Instructions"** → closes popup, calls `setActiveTab("application-instructions")`.
    - **"Skip for now"** → closes popup, continues sequence.
- Reappearance logic (once every 24h, until completion):
  - On every mover dashboard mount, if no completion row exists AND `last_reminded_at` is null or > 24h ago, show the popup and update `last_reminded_at`.
  - Once the mover clicks "I've completed studying" in the tab, completion row is inserted; popup never shows again.

## 2. Change Feed Posts popup to non-mandatory on first sign-in

- In `FeedPostPopup.tsx` `checkForUnreadPosts()`: fetch the mover's `profiles.created_at` (or first login timestamp) and filter unread posts to only those with `created_at > profile.created_at`. Posts that existed before the mover signed up are silently marked read (or simply skipped from the popup) so the popup only appears for genuinely new posts published after they joined.
- Backfill: on first dashboard load after this change, insert `feed_post_acknowledgments` rows for every existing post older than the user's `created_at` (idempotent upsert). This prevents the popup from surfacing legacy posts.
- The Feed tab itself continues to show all posts (including pre-signup ones) as browsable history — only the mandatory popup is scoped to post-signup content.

## 3. Platform coverage

- All changes live in shared React components used by both the web app and the Capacitor Android/iOS builds — no native code changes required. Sidebar entry appears in `MoverSidebar` (desktop) and the mobile shell nav automatically because it iterates the same tab list.

## Technical notes

- Files/videos stored in private `application-instructions` bucket, accessed via `createSignedUrl` (per project standard).
- All disclaimer strings use the existing `translations` inline object pattern used elsewhere (EN/ES/RU).
- Popup uses `AlertDialog` for consistency with `HandbookPopup`.
- 24h reminder check: SQL `now() - last_reminded_at > interval '24 hours'`.
- No changes to consent or handbook flows.

## Files touched

```text
NEW  src/components/dashboard/ApplicationInstructionsPopup.tsx
NEW  src/components/dashboard/MoverApplicationInstructions.tsx
NEW  src/components/dashboard/AdminApplicationInstructions.tsx
EDIT src/components/dashboard/MoverDashboard.tsx          (sequence + tab route)
EDIT src/components/dashboard/MoverSidebar.tsx            (new nav item + translations)
EDIT src/components/dashboard/AdminDashboard.tsx          (route new admin tab)
EDIT src/components/dashboard/AdminSidebar.tsx            (new admin nav item)
EDIT src/components/dashboard/FeedPostPopup.tsx           (post-signup filter + backfill)
MIGR application_instruction_materials, application_instruction_completions, RLS, GRANTs
BUCK application-instructions (private)
```
