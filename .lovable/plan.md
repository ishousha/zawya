# Allow admins to force-RSVP past capacity

## Problem
When an event is full and the waitlist is also full, the RSVP button is disabled for everyone — including admins and moderators. Admins need to be able to add any member regardless of capacity.

## Scope
UI-only change. The database does not enforce capacity on `rsvps` inserts (the waitlist promotion logic only triggers on cancel/expand), so admins/mods can already write — they just can't reach the modal.

## Changes

### 1. `src/components/EventCard.tsx`
- Treat `fullyClosed` as `false` when `isAdminOrMod` is true so the button stays enabled.
- When admin and event is over capacity, label the button **"Force RSVP"** (with a small subtle hint) instead of "Event Full" / "Waitlist Full" / "Join Waitlist".
- Normal members keep the existing fade/disable behavior unchanged.

### 2. `src/components/RSVPModal.tsx`
- Add a small amber notice at the top of the modal when admin/mod is RSVPing past capacity: *"This event is full. Your RSVP will be added as a confirmed attendee (admin override)."*
- No change to insert logic — admins already write directly; we just suppress the auto-waitlist flag for admin-created RSVPs (set `status: 'attending'`, `is_waitlisted: false` explicitly when admin and over capacity).

### 3. `src/components/admin/AdminRsvpAction.tsx` (already exists)
- Already lets admins add an RSVP for any user to any active/full event. Add an explicit `status: 'attending'` + `is_waitlisted: false` to the insert so a force-add doesn't accidentally land on the waitlist.

## Out of scope
- No schema changes, no new RLS, no audit log entry (existing `admin_activity_log` is not currently wired to RSVPs — separate request if wanted).
- No change to non-admin behavior.

## Verification
- As admin on a full+waitlist-full event: button reads "Force RSVP", modal opens with override notice, RSVP saves as attending.
- As approved member on same event: button stays disabled showing "Waitlist Full".
- AdminRsvpAction in user management: adding RSVP to a full event creates an attending row, not waitlisted.
