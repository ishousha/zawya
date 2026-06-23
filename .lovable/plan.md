## Goal
Give admins full control over any event's RSVPs from the existing **Event RSVP Detail** screen: edit any member or guest's RSVP, add any approved member (or promote from the waitlist), and remove RSVPs — all without leaving the event view.

## What admins will be able to do

From the event's "Manage Event → RSVPs" panel:

1. **Add anyone** to an event (already partially supported as "Walk-In") — expand the existing Walk-In modal into a generic **"Add RSVP"** action that does NOT force check-in, with toggles for "Mark as attending" vs. "Add to waitlist".
2. **Edit any row** (member or external guest):
   - Change party size (adults / children counts)
   - Add / rename / remove dependents on that RSVP
   - Move between **Attending ⇄ Waitlist**
   - Toggle check-in (already exists)
   - Cancel / restore the RSVP
3. **Promote from waitlist** — one-tap "Move to Attending" button on each waitlisted row.
4. **Remove an RSVP** — destructive button with confirm, writes an `admin_activity_log` entry.
5. **Family-aware safeguards** — surface the existing `RSVP_DUPLICATE_COVERED` / `RSVP_DUPLICATE_MEMBER` trigger errors as friendly toasts so admins can't accidentally double-book a family member.

## UI changes (frontend only — RLS already allows admins full access to `rsvps`)

### `src/components/admin/EventRsvpDetail.tsx`
- Add a per-row **Edit** (pencil) and **Remove** (trash) button next to the existing Check-in toggle, in both the **Attending** table and the **Waitlisted** table.
- Waitlisted rows also get a **"↑ Move to Attending"** button.
- Both tables share a new **`EditRsvpDialog`** modal (below).

### New `src/components/admin/EditRsvpDialog.tsx`
Modal that lets an admin edit a single RSVP:
- Read-only member name / email header
- Adults count (number input, min 1)
- Children/dependents list — add/edit/remove rows (name + age group), mirroring the user-facing RSVP modal
- Status select: `Attending` / `Waitlisted` / `Cancelled`
- Check-in toggle
- Save → `UPDATE rsvps SET guests_count, attending_dependents, status, is_waitlisted, checked_in` + activity log entry
- Cancel button closes without saving

### Generalize `WalkInRsvpModal.tsx` → `AddRsvpModal.tsx`
- Add a "Mode" toggle: **Walk-In (auto check-in)** | **Add RSVP** | **Add to Waitlist**.
- "Add RSVP" inserts with `checked_in:false, is_waitlisted:false`, "Add to Waitlist" with `is_waitlisted:true, status:'waitlisted'`.
- The header button on `EventRsvpDetail` becomes a small dropdown: **Add Attendee ▾** → Walk-In / Add RSVP / Add to Waitlist.

### Remove-RSVP confirmation
- AlertDialog: "Remove {name}'s RSVP for {event}? This cannot be undone."
- Mutation: `DELETE FROM rsvps WHERE id = …` + log `rsvp_admin_remove`.

## Backend
No schema or RLS migration required — admins already have `FOR ALL` access via the `Admins can manage all rsvps` policy, and the `prevent_duplicate_family_rsvp` trigger already protects family integrity. We will only **invalidate** the same React Query keys already in use (`admin-rsvps`, `host-rsvps`, `event-rsvp-counts`, `existing-rsvp-users`).

## Out of scope
- Editing potluck sign-up items (already supported in the Potluck tab).
- Editing external guests / `guest_requests` (already has its own approval flow).
- Bulk edit / multi-select.
- Capacity-override warnings beyond the existing yellow "at capacity" banner.
