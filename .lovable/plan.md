
## Knowledge Base Feature Plan

### Database Changes
1. **`knowledge_base_folders`** table — stores folders created by admin (name, description, created_by, created_at)
2. **`knowledge_base_materials`** table — stores uploaded files per folder (folder_id, file_name, file_url, file_type, file_size, uploaded_by, created_at)
3. **`knowledge_base_folder_shares`** table — maps folders to roles they're shared with (folder_id, shared_role, shared_at, shared_by)
4. **Storage bucket** `knowledge-base` for file uploads
5. **RLS policies**: Admin full access; other roles can only view folders/materials shared with their role
6. **Notifications**: Insert into `mover_notifications` for users with matching roles when a folder is shared

### UI Components
1. **`AdminKnowledgeBase.tsx`** — Admin view: create folders, upload materials (docs/audio/video/images), share folders with roles, delete folders/materials
2. **`KnowledgeBaseViewer.tsx`** — Read-only viewer for other roles: browse shared folders, view/download materials
3. **Nav updates**: Add "Knowledge Base" tab to AdminSidebar, and to sidebars/dashboards for accountant, operations manager, reviews admin, HR manager, office staff

### Language Support
- All UI text in EN/ES/RU

### Notification Flow
- When admin shares a folder with a role, insert notifications for all users with that role
