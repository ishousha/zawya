## Goal
Let admins force-add RSVPs/walk-ins/waitlist entries even when the event is full, and auto-expand event capacity (or waitlist capacity) to absorb the overflow so the counts stay consistent.

## Behavior
- When an admin uses **Add Attendee** (Walk-In, RSVP) or **Add to Waitlist** and the requested party would exceed capacity:
  - Show a warning with an **"Add anyway (expand capacity)"** confirm button instead of blocking.
  - On confirm, the server bumps `events.capacity` (or `waitlist_capacity` for the waitlist mode) by exactly the overflow amount, then inserts the RSVP.
- Same override path is offered in **Edit RSVP** when increasing party size or promoting from waitlist would exceed capacity.
- Non-admin RSVP flows are unchanged — capacity is still enforced for members.
- Every override writes an `admin_activity_log` entry (`action: 'capacity_override'`, includes event_id, delta, new capacity, target user).

## Technical Changes

### Backend
- New RPC `admin_force_rsvp(event_id, user_id, guests_count, mode, dependents)` — `SECURITY DEFINER`, admin-only via `has_role`. It:
  1. Computes overflow vs. `capacity` (or `waitlist_capacity` when `mode='waitlist'`).
  2. `UPDATE events SET capacity = capacity + overflow` (or waitlist_capacity) when overflow > 0.
  3. Inserts the RSVP with correct `status` / `is_waitlisted` / `checked_in` (walkin auto check-in).
  4. Inserts `admin_activity_log` row.
- New RPC `admin_force_update_rsvp(rsvp_id, new_guests_count, new_status)` — same override + logging for edits/promotions.
- Update `enforce_event_capacity_on_rsvp` trigger to skip enforcement when the current session is inside these RPCs (use a `pg_temp` flag set by the RPC), so the trigger still protects normal member paths.

### Frontend
- `WalkInRsvpModal`: when `isAtCapacity` (or waitlist full), replace the blocking warning with an explicit **"Add anyway — this will expand capacity by N"** confirm step, then call the new RPC instead of a direct insert.
- `EditRsvpDialog`: on `RSVP_CAPACITY_EXCEEDED` error, surface an **"Override & expand capacity"** button that retries via the force-update RPC.
- Toasts confirm the new capacity ("Capacity expanded to X").

### Files touched
- `supabase/migrations/<new>_admin_force_rsvp.sql`
- `src/components/admin/WalkInRsvpModal.tsx`
- `src/components/admin/EditRsvpDialog.tsx`
- `src/components/admin/EventRsvpDetail.tsx` (promote-from-waitlist path already surfaced here)
- `src/lib/rsvp-errors.ts` (helper to detect capacity errors is already there — reused)
- `public/version.json`
