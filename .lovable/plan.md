## Goal
Make the admin "Suspend / Kick out" action in **Edit RSVP** safer, more visible to the affected member, and harder to bypass — while staying fully reversible.

## What changes

### 1. Confirmation dialog before removal
In `EditRsvpDialog.tsx`, wrap the destructive **Suspend / Kick out** button in a shadcn `AlertDialog`:
- Title: "Remove this person from the event?"
- Body: names the member and event, explains: seat is freed, ticket disappears from their app, event is hidden from their home feed, and they cannot re-RSVP unless an admin reinstates them. Mentions a 10-second Undo will appear.
- Confirm button (destructive): "Yes, remove"
- Cancel button: "Keep RSVP"

### 2. Mark admin-removal distinctly (so it differs from self-cancel)
Self-cancelled RSVPs today can be re-created by the same user. We need a flag the user *cannot* clear.

**Migration** on `public.rsvps`:
- Add `removed_by_admin boolean NOT NULL DEFAULT false`
- Add `removed_by_admin_at timestamptz`
- Add `removed_by_admin_actor uuid REFERENCES auth.users(id)`
- Trigger `prevent_user_clearing_admin_removal`: on UPDATE, if the caller is not admin/moderator/service_role, block any change that sets `removed_by_admin` from true to false, or that changes `status` away from `cancelled` while `removed_by_admin = true`. Also block INSERT of a new active RSVP for the same `(event_id, user_id)` when a prior row has `removed_by_admin = true` (admins/moderators bypass).
- No new GRANTs needed (column additions inherit existing table grants).

### 3. Wire the suspend action to the new flag
In `EditRsvpDialog.tsx`, the confirmed "Remove" path updates:
```
status: 'cancelled', is_waitlisted: false, checked_in: false,
removed_by_admin: true, removed_by_admin_at: now(), removed_by_admin_actor: <admin.id>
```
Activity log entry uses `action: 'rsvp_admin_remove'` with previous-state snapshot (already the existing undo pattern).

### 4. Reversibility — three layers
- **Inline Undo toast (10s)** after the action: restores all previous fields including `removed_by_admin = false` (admin call, so trigger allows it). Same pattern already used by `EditRsvpDialog`'s edit flow.
- **Re-open Edit RSVP** on the cancelled row: changing Status away from "Cancelled" automatically clears `removed_by_admin` in the save payload (admin update). Helper text under Status notes "Reinstating clears the removal block."
- **Trash icon** in the RSVP list still hard-deletes; unaffected.

### 5. Member-side effects (the "removed from feed / can't RSVP again" part)
- **`useRSVP.ts`** — the booking mutation already does an upsert on `(event_id, user_id)`. Add a pre-check: if the existing row has `removed_by_admin = true` AND the caller is not admin/moderator, throw a friendly error: "An organizer has removed you from this event. Please contact them if this was a mistake." (The DB trigger is the hard guardrail; the client check gives a clean toast.)
- **`RSVPModal.tsx`** — when `existingRsvp.removed_by_admin === true` for the current user, replace the RSVP form CTA with a read-only notice card ("You've been removed from this event by an organizer") and disable the Confirm button.
- **`HomeFeed.tsx`** — in the visible-events filter, hide any event where the user's RSVP row has `removed_by_admin = true`. This removes it from their home feed and from "My upcoming" listings. The event still exists for everyone else; only this user no longer sees it.
- **`QRTicketScreen` / ticket entry points** — already guarded by `status !== "cancelled"`, so the ticket disappears automatically. No change needed.
- **Notification** — insert a row into `public.notifications` for the affected user: title "RSVP removed", message naming the event, type `rsvp`. Uses the existing notifications table; no schema change.

### 6. Optional polish
- Status dropdown in `EditRsvpDialog` shows a small red "Removed by admin" badge next to "Cancelled" when `removed_by_admin = true`, so admins immediately understand why the row is cancelled.
- Helper text under the destructive section updates to: "They will see a removal notice and cannot RSVP again until reinstated."

## Files touched
- `supabase/migrations/<new>.sql` — add columns + trigger.
- `src/components/admin/EditRsvpDialog.tsx` — AlertDialog confirm, new payload fields, "Removed by admin" badge, helper copy, undo wiring.
- `src/components/RSVPModal.tsx` — read-only "you've been removed" state.
- `src/hooks/useRSVP.ts` — pre-check + friendly error on booking attempt.
- `src/pages/HomeFeed.tsx` — filter out events where the user's RSVP has `removed_by_admin = true`.
- `src/integrations/supabase/types.ts` — regenerated after migration approval.

## Not changing
- Trash-icon hard delete behaviour.
- Existing self-cancel flow (members can still cancel and re-RSVP themselves).
- Capacity / waitlist promotion logic (cancelled seat already frees up).

## Technical notes (for reviewers)
- The trigger MUST allow `service_role` and `has_role(auth.uid(),'admin'|'moderator')` to clear the flag — otherwise Undo and reinstatement break.
- `removed_by_admin` is the source of truth; `status='cancelled'` alone keeps meaning "self-cancelled, can re-RSVP".
- HomeFeed filter is purely a UX decision — RLS does not need to hide the event because the event itself isn't sensitive; only the user's view is curated.