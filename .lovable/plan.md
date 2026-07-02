## Problem

Guests are stored in `guest_requests` and are entirely invisible to capacity logic:

- `enforce_event_capacity_on_rsvp` only reads `rsvps`.
- `get_event_rsvp_counts` only sums `rsvps.guests_count`.
- Approving a guest request or adding a walk-in guest never consumes a seat.
- Admins can’t "force" a guest either — because nothing currently blocks them, but nothing expands capacity either, so the number displayed elsewhere is wrong.

Each approved guest should count as **1 seat** against `events.capacity` (the same way an RSVP `guests_count` does). If an admin forces a guest over capacity, `events.capacity` auto-expands by the exact overflow, mirroring the existing `admin_expand_event_capacity` flow used by walk-in RSVPs.

## Plan

### 1. Database — count approved guests toward capacity

New migration:

- **Extend `get_event_rsvp_counts`** to add approved (non-cancelled/non-rejected) `guest_requests` into `attending_count` and, when the guest is marked checked-in via existing columns, into `checked_in_count`. Non-breaking: same return shape.
- **New trigger `enforce_event_capacity_on_guest_approval`** on `guest_requests` (BEFORE INSERT OR UPDATE):
  - Fires when the resulting row is `status = 'approved'`.
  - Computes `current = SUM(rsvps.guests_count attending, excluding host) + COUNT(approved guest_requests excluding this row)`.
  - Raises `GUEST_CAPACITY_EXCEEDED: … attempted=1 current=X capacity=Y remaining=Z` (same shape as the RSVP error, parseable by `parseCapacityError`).
- **Update `admin_expand_event_capacity`** — already exists and is admin-gated; no change needed. Guests always consume the `attending` bucket (not waitlist).

### 2. Frontend — surface guests in capacity + self-heal on force-add

- **`src/hooks/useRSVP.ts`** — no logic change; `useEventRsvpCounts` will now include guests automatically via the updated RPC.
- **`src/components/admin/WalkInGuestDialog.tsx`**:
  - Wrap the insert in the same self-heal pattern used in `WalkInRsvpModal.tsx`: on `GUEST_CAPACITY_EXCEEDED`, parse the shortfall, call `admin_expand_event_capacity({ _kind: 'attending', _extra_seats: shortfall })`, retry once, then toast `"Walk-in added · Capacity expanded by N"`.
  - Invalidate `["rsvp-counts", eventId]` and `["event-capacity", eventId]` so the header chip refreshes.
- **`src/components/admin/AdminGuestApprovals.tsx`** and **`src/components/admin/AllGuestApprovals.tsx`**:
  - In `handleAction(r, "approved")`, on `GUEST_CAPACITY_EXCEEDED` from the mutation, run the same expand-then-retry once, and show a toast noting the expansion.
  - Invalidate `rsvp-counts` / `event-capacity` after success so the "Remaining X / Y" chip in `EventRsvpDetail` stays accurate.
- **`src/lib/rsvp-errors.ts`** — extend `parseCapacityError` to also recognize the `GUEST_CAPACITY_EXCEEDED:` prefix (same regex format).
- **`src/components/admin/EventRsvpDetail.tsx`** — no code change needed; the "Remaining" chip already reads from `useEventRsvpCounts`, which will now include guests.

### 3. Non-admin member guest requests

A member requesting a guest for a full event will now fail with the new capacity error (correct behavior — members shouldn't be able to bypass capacity). The existing `capacityToastFromError` helper will render a clear message. No UI change beyond the error surfacing.

### 4. Out of scope

- Not merging `guest_requests` into `rsvps`.
- Not touching the waitlist for guests (guests never enter waitlist today; leaving as-is).
- No change to `EventControlRoom` counts — they read from the same RPC and will update automatically.

## Files touched

- New: `supabase/migrations/<ts>_guests_count_toward_capacity.sql`
- Edit: `src/lib/rsvp-errors.ts`
- Edit: `src/components/admin/WalkInGuestDialog.tsx`
- Edit: `src/components/admin/AdminGuestApprovals.tsx`
- Edit: `src/components/admin/AllGuestApprovals.tsx`
- Bump: `public/version.json`
