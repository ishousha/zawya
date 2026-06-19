# Enrich Admin Activity Log

Today the log only records user-management actions (role change, suspend, delete, create) and check-ins. We'll auto-capture admin actions across all major content tables via database triggers — nothing for app code to remember to call, and impossible to bypass.

## What will be tracked

For each table below, every INSERT / UPDATE / DELETE performed by an admin (or moderator) is recorded with the actor, the target object's name, and a `details` JSON containing the changed fields:

- **events** — create, publish/unpublish, edit (title, date/time, location, capacity, status, etc.), cancel, reactivate, delete
- **venues** — add, edit (name, address, maps_url), delete
- **event_types** — add, edit, delete
- **speakers** — add, edit, delete
- **event_speakers** — assign / unassign speaker from event
- **event_sign_up_items** — add, edit, delete sign-up items on an event
- **resources** — add, edit, delete
- **announcements** — create, edit, delete
- **guest_requests** — approve / reject / delete (currently no log entry)
- **families** — create, rename, delete

Existing logged actions (role_change, suspend_user, delete_user, create_user, checkin_rsvp, undo_checkin, broadcast) stay as they are.

## How it works (technical)

1. **One SECURITY DEFINER helper** `public.log_admin_change(action text, target_id uuid, target_label text, details jsonb)` that:
   - Returns immediately if `auth.uid()` is null or service_role (lets seed/edge writes skip logging when desired).
   - Skips logging if the actor doesn't have `admin` or `moderator` role (so member-level inserts on e.g. `guest_requests` aren't logged).
   - Inserts a row into `admin_activity_log` with `actor_id = auth.uid()`, the action, and details. We reuse `target_user_name` to store the object's display label (e.g. event title, venue name) so the existing UI keeps working.

2. **Per-table AFTER trigger functions** (one per table) that call the helper. For UPDATEs they diff OLD/NEW and only include changed fields in `details` (plus a `before`/`after` snapshot for important ones like `status`, `published`, `capacity`, `date_time`). For DELETEs they snapshot the old row.

3. **No schema change to `admin_activity_log`** is required — `target_user_id` is nullable and we already have a JSONB `details` column.

## UI changes (`AdminActivityLog.tsx`)

- Extend `ACTION_CONFIG` with all new action keys, icons (Calendar, MapPin, Tag, Mic, FileText, Megaphone, UserCheck, Users, Package), labels, and badge variants.
- Group the action filter `<Select>` into sections: Users, Events, Content, Guests, Check-ins.
- Replace the hard-coded "Target user" column heading with "Target" — the trigger writes the object's label into `target_user_name`, so the existing row template already renders it.
- Add a generic details renderer that pretty-prints the `details` JSON's `changed` fields (key: old → new) for any update action, so we don't need a custom switch per action.
- CSV export updated to include the same generic details string.

## Out of scope

- Backfilling history for actions that happened before the triggers exist.
- Logging RSVP edits made by members on their own RSVPs (still only admin walk-in edits, captured via the rsvps trigger gated on admin role).
- A "revert" button — read-only log only.

## Files touched

- New migration: `supabase/migrations/<ts>_admin_activity_log_triggers.sql` — helper function + per-table trigger functions + triggers.
- `src/components/admin/AdminActivityLog.tsx` — new action configs, grouped filter, generic details renderer, CSV update.
