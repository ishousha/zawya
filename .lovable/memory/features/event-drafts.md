---
name: Event Draft System
description: Events have published boolean + scheduled_publish_at; drafts admin-only, auto-publish via cron
type: feature
---
- `published` boolean column on events table (default false)
- `scheduled_publish_at` timestamptz column (nullable) — future auto-publish time
- RLS: approved/guest users can only see events where published=true
- Admin/moderator RLS unchanged (see all events)
- EventFormState includes `published` and `scheduled_publish_at` fields
- Form footer: "Save Draft" (published=false) and "Publish & Notify" / "Update" buttons
- SettingsTab shows publish toggle when editing, and scheduled publish datetime picker when unpublished
- Admin event cards show Draft (amber), Scheduled (blue), or Published (green) badges
- `auto-publish-events` edge function runs via pg_cron every minute, publishes due drafts and notifies members
- Notifications only fire on first draft→published transition (not on re-saves of published events)
- Navigation guard: beforeunload + useBlocker (react-router) + close confirm dialog
