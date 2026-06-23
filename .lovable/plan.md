## Goal
Three admin-safety improvements for event RSVP management:

1. Confirm before moving a waitlist entry to Attending.
2. Prevent (and clearly explain) RSVP edits/promotions that would exceed event capacity — enforced server-side, surfaced in the UI.
3. Let an admin undo their most recent RSVP edit, promote, or remove action to restore the previous state.

## 1. Promote-from-Waitlist confirmation

**File:** `src/components/admin/EventRsvpDetail.tsx`

- Wrap the existing "↑ Move to Attending" button in an `AlertDialog`.
- Dialog body shows: member name, the party size being promoted, current attending vs capacity, and the resulting attending count after promotion.
- If promotion would push past capacity, show an inline warning and disable the confirm button (the server will also block it — see §2).
- Confirm button text: "Move to Attending". Cancel keeps them on waitlist.

## 2. Server-side capacity validation + clear UI errors

### Database trigger (new migration)

Add `enforce_event_capacity_on_rsvp` (BEFORE INSERT OR UPDATE on `public.rsvps`):

- Skip when `NEW.status = 'cancelled'` or `NEW.is_waitlisted = true`.
- Skip for the event `host_id` (hosts don't consume capacity, matching existing `get_event_rsvp_counts` logic).
- Load `events.capacity`; if NULL → unlimited, allow.
- Compute current attending sum excluding host and excluding `OLD` (when UPDATE on same row):
  ```sql
  SELECT COALESCE(SUM(guests_count),0)
  FROM rsvps
  WHERE event_id = NEW.event_id
    AND status = 'attending' AND COALESCE(is_waitlisted,false)=false
    AND user_id <> events.host_id
    AND id <> COALESCE(NEW.id, '00000000-...');
  ```
- If `current + NEW.guests_count > capacity` →
  `RAISE EXCEPTION 'RSVP_CAPACITY_EXCEEDED: Adding % seats would exceed capacity (% / %).', NEW.guests_count, current, capacity USING ERRCODE = 'check_violation';`

This blocks party-size increases, status flips waitlisted→attending, and waitlist promotions that overflow capacity — for both admin and member actions.

### UI surfacing

- `EditRsvpDialog.tsx`: accept `attendingCount`, `capacity`, `hostId`, `currentRsvpCount` props. Compute live "after-save" projection and show:
  - Helper text under Adults: `X of Y seats used · this RSVP will take N`.
  - Red inline error + disabled Save when the new total would exceed capacity (skipped when status = `waitlisted` or `cancelled`, or user is the host).
- `EditRsvpDialog`, `WalkInRsvpModal`, `promoteFromWaitlist`, `removeRsvp` mutation `onError` handlers: detect `RSVP_CAPACITY_EXCEEDED:` prefix and show a friendly toast: "Over capacity — {detail}".
- Update `useRSVP.ts` `getErrorMessage` to strip the same prefix for member-facing flows.

## 3. Undo for admin RSVP edits / promote / remove

### Snapshot-based undo

`admin_activity_log.details` already accepts JSON. Extend the existing `rsvp_admin_edit`, `rsvp_admin_promote`, and `rsvp_admin_remove` log entries with a `previous` snapshot:

```json
{
  "event_id": "...",
  "rsvp_id": "...",
  "previous": {
    "guests_count": 4,
    "attending_dependents": [...],
    "status": "attending",
    "is_waitlisted": false,
    "checked_in": true
  }
}
```

For `rsvp_admin_remove`, store the full row (all editable columns) so it can be re-inserted.

### Undo UI

`EventRsvpDetail.tsx`:

- Track the last admin RSVP action for this event in component state: `{ kind: 'edit'|'promote'|'remove', logId, rsvpId, eventTitle, name, previous }`. Set it inside each mutation's `onSuccess`.
- Show a sonner toast with an **Undo** action button (sonner's `toast.success(msg, { action: { label: 'Undo', onClick } })`) on every successful edit/promote/remove. Undo button stays available for ~10s (default toast duration) — no separate panel.
- Undo handler:
  - `edit` / `promote` → `UPDATE rsvps SET ...previous WHERE id = rsvp_id` (subject to the same capacity trigger; if it now fails because someone else filled the seat, show "Cannot undo — event is now full").
  - `remove` → re-`INSERT` the saved row (preserve the original `id` so QR hashes / selections still line up).
  - Write a follow-up `admin_activity_log` entry with `action: 'rsvp_admin_undo'` referencing the original `logId` and clear the in-memory `lastAction` to avoid double-undo.
  - Invalidate the same React Query keys already invalidated by the original mutations.

### Out of scope

- Undo for self-service member RSVPs.
- Multi-step undo history / timeline view (only the most recent admin action is undoable).
- Editing potluck sign-up items (already has its own flow).

## Technical summary

- **Migration:** `enforce_event_capacity_on_rsvp` trigger function + `BEFORE INSERT OR UPDATE` trigger on `public.rsvps`. No schema changes; no new tables; no new RLS.
- **Frontend:**
  - `src/components/admin/EventRsvpDetail.tsx` — AlertDialog for promote, undo toasts, undo mutations, capacity props passed to `EditRsvpDialog`.
  - `src/components/admin/EditRsvpDialog.tsx` — capacity-aware props, inline projection + error, save disabled when over capacity.
  - `src/components/admin/WalkInRsvpModal.tsx` — friendly error mapping for `RSVP_CAPACITY_EXCEEDED`.
  - `src/hooks/useRSVP.ts` — extend `getErrorMessage` prefix stripping.
- **React Query keys invalidated on undo:** `admin-rsvps`, `host-rsvps`, `event-rsvp-counts`, `door-attendees`, `existing-rsvp-users` (same set already in use).
