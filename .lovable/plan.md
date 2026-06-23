## Goal
Three follow-up admin RSVP improvements building on the existing capacity-trigger + undo work:

1. Add an "Undo" action to the **error** toast for promote/remove (and edit) when the action failed, so admins can quickly re-apply the last successful state if needed mid-edit.
2. Show a live **Remaining seats** indicator on the `EventRsvpDetail` header that updates in real time as admins open/edit RSVPs.
3. Make every capacity-related server error toast show the exact **attempted delta** and the **remaining capacity**.

## 1. Error-state undo for last successful RSVP action

**File:** `src/components/admin/EventRsvpDetail.tsx`

- Introduce component-level state `lastAction: { kind: 'edit'|'promote'|'remove', rsvpId, eventTitle, name, previous, removedRow? } | null`.
- Populate it inside the existing `onSuccess` handlers for the promote, remove, and (forwarded from `EditRsvpDialog`) edit mutations.
- When any subsequent admin RSVP mutation hits `onError`, show an error toast that includes an **Undo last change** action button if `lastAction` is set and was within the last 60s. Clicking it runs the same undo logic already wired into the success toast (UPDATE back to `previous`, or re-INSERT the removed row), then clears `lastAction`.
- After undo succeeds, show "Reverted last RSVP change". After it fails (e.g. capacity now full), show the standard capacity-error toast (see §3).
- `EditRsvpDialog`: accept an optional `onActionRecorded(action)` callback and call it from its `save` `onSuccess` so the parent's `lastAction` stays in sync; the dialog's own success toast keeps its inline Undo button as today.

## 2. Live "Remaining seats" indicator in the header

**File:** `src/components/admin/EventRsvpDetail.tsx`

- The header already renders capacity/attending data from `eventMeta` + `get_event_rsvp_counts`. Replace the static badge with a `Remaining: X / Y` chip:
  - `remaining = capacity - attendingCount` (excluding host, matching `get_event_rsvp_counts`).
  - Color: neutral when `remaining > 5`, amber `<=5`, red `<=0`.
  - Tooltip: "Hosts and waitlisted entries do not consume capacity."
- Make it react live to edits in-flight:
  - `EditRsvpDialog` exposes a new `onProjectionChange?(projectedAttending: number)` prop. Parent stores `previewAttending`. The header shows `Remaining` based on `previewAttending ?? attendingCount` while the dialog is open, then snaps back on close.
  - For promote confirm AlertDialog and WalkInRsvpModal: same idea — pass a callback so opening or changing party size updates the header preview.
- Counts already invalidate via React Query on every mutation success, so post-save the chip naturally reflects the new truth.

## 3. Capacity errors with attempted delta + remaining

### Trigger message (new migration)

Update `enforce_event_capacity_on_rsvp` to include both pieces explicitly so clients can parse them:

```
RSVP_CAPACITY_EXCEEDED: Adding {delta} seat(s) would exceed capacity.
attempted={delta} current={current} capacity={capacity} remaining={remaining}
```

Where `delta = NEW.guests_count - (OLD.guests_count if same row and previously attending else 0)` so it reflects the *change*, not just the new total. Keep the human sentence at the start; append a machine-readable tail `attempted=… current=… capacity=… remaining=…`.

### Client parsing

- Add `src/lib/rsvp-errors.ts` with `parseCapacityError(message)` → `{ attempted, current, capacity, remaining, human } | null`.
- Update every existing capacity-error `onError` handler (`EditRsvpDialog`, `WalkInRsvpModal`, `EventRsvpDetail` promote / remove / undo, `useRSVP.ts` `getErrorMessage`) to use the parser and render:
  - Title: "Over capacity"
  - Description: `Tried to add N seat(s). Only M seat(s) left (X / Y used).`
  - Falls back to the raw message if parsing fails.
- Same parser feeds the error-state undo toast in §1 so the message is consistent.

## Out of scope

- No new tables or RLS changes.
- No changes to self-service member RSVP flows beyond the friendlier message string.
- No expansion of undo history (still only the most recent admin action).

## Technical summary

- **Migration:** replace `enforce_event_capacity_on_rsvp` function body with the richer error string. Trigger definition itself unchanged.
- **Frontend:**
  - `src/components/admin/EventRsvpDetail.tsx` — `lastAction` state, error-state Undo wiring, live Remaining-seats chip, projection callbacks from dialogs.
  - `src/components/admin/EditRsvpDialog.tsx` — `onActionRecorded`, `onProjectionChange` props; use shared parser for capacity errors.
  - `src/components/admin/WalkInRsvpModal.tsx` — `onProjectionChange`; use shared parser.
  - `src/hooks/useRSVP.ts` — `getErrorMessage` uses shared parser for friendlier member-facing text.
  - New `src/lib/rsvp-errors.ts` — `parseCapacityError`.
