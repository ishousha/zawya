# Fix: Male users can RSVP to "Sisters Only" events

## Root cause

DB trigger `enforce_event_gender_audience` and the frontend `genderBlock`/`genderBlocked` guards already block **new** male RSVPs on Sisters-Only events (and vice versa). The remaining loopholes:

1. **`RSVPModal.tsx`** — `genderBlocked` is `false` when `isEditing` is true. So a mismatched user who already has an RSVP (e.g. event was originally "Everyone" and an admin later changed it to "Sisters Only") can keep editing/confirming via the modal.
2. **`EventCard.tsx`** — when `isAttending`, the card shows "Edit RSVP" / "View Ticket" with no gender check, so a now-mismatched user sees no warning that they should cancel.
3. **DB-level audience changes** — when an admin updates `events.audience_gender`, existing mismatched RSVPs are not cleaned up. The `enforce_event_gender_audience` trigger only fires on RSVP INSERT/UPDATE, not on `events` UPDATE.
4. **Trigger UPDATE skip** — current trigger early-returns on `UPDATE` when `event_id` and `user_id` are unchanged. That's fine for keeping admin-driven check-ins working, but means a mismatched user editing their RSVP via the SDK directly is not re-validated. (UI fix above closes the practical path; trigger stays as is.)

## Plan

### 1. `src/components/RSVPModal.tsx`
- Drop the `!isEditing` exemption from `genderBlocked` so the gender block screen always shows for mismatched users. Replace the "Close" button with two buttons:
  - "Close"
  - "Cancel my RSVP" (only if `myRSVP` exists and not cancelled) — calls existing `handleCancel()`.
- Copy: "This gathering is now restricted to {brothers/sisters} only. Please cancel your RSVP."

### 2. `src/components/EventCard.tsx`
- In the action area (lines ~476–520), when `isAttending && genderBlock` (and not admin/mod), replace the "Edit RSVP / View Ticket" row with:
  - A small warning chip: `genderBlock.label` + "Your RSVP no longer matches this event's audience."
  - A single "Cancel RSVP" button that opens `RSVPModal` (existing modal will surface the cancel action from step 1).
- Admins/mods continue to see the normal Edit/Ticket buttons (already excluded from `genderBlock`).

### 3. Database trigger on `events` (new migration)
- Add `BEFORE UPDATE` trigger on `public.events`: when `audience_gender` changes from `Everyone` to `Brothers Only` / `Sisters Only` (or between the two), cancel all mismatched non-cancelled RSVPs:
  - `UPDATE rsvps SET status='cancelled', is_waitlisted=false WHERE event_id = NEW.id AND user_id IN (SELECT id FROM profiles WHERE gender IS DISTINCT FROM <required_gender>)`.
  - Insert a `notifications` row for each affected user explaining the cancellation.
- This guarantees historical RSVPs cannot leak through the UI even if a frontend check is missed.

## Out of scope
- Changing how admins create walk-in RSVPs (admin override is intentional).
- Auto-removing dependents whose gender mismatches (separate concern; dependents currently have no gender field used in this check).
- Refactoring `enforce_event_gender_audience`.

## Files touched
- `src/components/RSVPModal.tsx` — gender block always shown for mismatched users; add cancel-RSVP action.
- `src/components/EventCard.tsx` — replace edit/ticket buttons with warning + cancel for mismatched attendees.
- New Supabase migration — trigger on `events` to cancel mismatched RSVPs and notify users when audience tightens.
