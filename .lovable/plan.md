## Bug
Admin sees "Over capacity — Tried to add 1 seat. Only 0 seats left (21/21 used)" and the RSVP is blocked, even though the flow is supposed to auto-expand capacity for admins.

## Root cause
In `WalkInRsvpModal.tsx` the pre-flight overflow is computed from `useEventRsvpCounts(eventId)`, but:
1. That hook's real query key is `["rsvp-counts", eventId]` while the modal invalidates `["event-rsvp-counts", eventId]` — so counts are stale/zero on first open.
2. When counts read as 0, `overflow = max(0, 0 + 1 - 21) = 0`, so the button renders as "Confirm Walk-In" and the `admin_expand_event_capacity` RPC is never called.
3. The insert then hits the `enforce_event_capacity_on_rsvp` trigger with real DB state (21/21) and fails with `RSVP_CAPACITY_EXCEEDED`.

The same stale-counts pattern exists in `EditRsvpDialog` (pre-flight expand only fires when the modal already knows the true attending total).

## Fix

### 1. Make the admin add/edit paths self-healing on capacity errors
In the `onError` handlers for `WalkInRsvpModal` and `EditRsvpDialog`, when the error parses as `RSVP_CAPACITY_EXCEEDED`:
- Read `attempted` and `remaining` from `parseCapacityError`.
- Compute `expandBy = attempted - remaining` (min 1).
- Call `supabase.rpc("admin_expand_event_capacity", { _event_id, _extra_seats: expandBy, _kind: "attending" })` and re-run the same mutation once.
- On the retried success, toast `"Added — capacity expanded by N"`. Only surface the current error toast if the retry itself fails.

This guarantees admins can always force-add, regardless of whether the client-side count was fresh.

### 2. Fix the stale-count query key so the pre-flight branch also works
- Update the invalidations in `WalkInRsvpModal`, `EditRsvpDialog`, and `EventRsvpDetail` from `["event-rsvp-counts", eventId]` to `["rsvp-counts", eventId]` to match `useEventRsvpCounts`.
- Keep the existing `["event-capacity", eventId]` invalidations for the header chip.

### 3. UI polish
- While the auto-expand retry is in flight, keep the button in its `isPending` state so it doesn't look like nothing happened.
- The retried success toast wins; do not also show the capacity error toast.

## Files touched
- `src/components/admin/WalkInRsvpModal.tsx` — auto-retry-with-expand in `onError`; fix invalidation key.
- `src/components/admin/EditRsvpDialog.tsx` — same auto-retry-with-expand; fix invalidation key.
- `src/components/admin/EventRsvpDetail.tsx` — fix invalidation key so the header remaining-seats chip updates immediately after admin actions.
- `public/version.json` — bump.

No database, RLS, or non-admin RSVP behavior changes.
