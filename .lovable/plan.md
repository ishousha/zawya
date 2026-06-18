# Tappable Check-in in Admin Guest List

Currently the Check-in column in the admin event's Guest List (Events → event → Guests tab) only displays status as a read-only icon. Add the ability to toggle check-in by tapping the circle/check directly in the row.

## Changes

**File: `src/components/admin/EventRsvpDetail.tsx`**

1. Add a mutation (TanStack Query) that updates `rsvps.checked_in` for a given rsvp id:
   - On toggle on: `update({ checked_in: true })`
   - On toggle off: `update({ checked_in: false })` (matches Door Scanner's undo behavior)
   - On success: invalidate the event-rsvps query so the list refreshes, plus the door-scanner / host queries.
   - Toast success ("Checked in {name}" / "Undid check-in for {name}") and error.

2. Replace the read-only cell at lines 436–442 with a `<button>` (≥44px tap target, accessible label) that:
   - Renders the green `CheckCircle2` when `checked_in === true`.
   - Renders an empty circle (`Circle` from lucide-react, muted) when false.
   - Calls the mutation with optimistic UI (disabled while pending).
   - Includes `aria-label="Mark {name} as checked in"` / "Undo check-in for {name}".

3. Add a brief confirmation (AlertDialog) only when **undoing** a check-in (to prevent accidental taps); direct check-in is a single tap with toast.

## Out of scope
- Waitlisted rows (no check-in column there).
- Bulk check-in.
- Changing the Door Scanner, Host Dashboard, or RPCs.
- No DB/RLS changes — admins already have UPDATE on `rsvps` (same path used by Door Scanner and Walk-in modal).
