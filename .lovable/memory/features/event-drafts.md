---
name: Event Draft System
description: Events have a published boolean column; drafts are admin-only, published events visible to members via RLS
type: feature
---
- `published` boolean column on events table (default false)
- RLS: approved/guest users can only see events where published=true
- Admin/moderator RLS unchanged (see all events)
- EventFormState includes `published` field
- Form footer has "Save Draft" (published=false) and "Publish" (published=true) buttons
- SettingsTab shows publish toggle when editing existing events
- Admin event cards show Draft (amber) or Published (green) badges
- Navigation guard (beforeunload + close confirm dialog) was already present
