## Goal

Restore correct waitlist behaviour so members joining a full Thursday Gathering land on the waitlist (not as confirmed attendees), block edits that would push a party past capacity, stop forcing admins onto attending when seats remain, and warn admins when a walk-in would exceed capacity.

## Files touched (only these three)

- `src/hooks/useRSVP.ts`
- `src/components/RSVPModal.tsx`
- `src/components/admin/WalkInRsvpModal.tsx`

No DB migration. No other files.

---

## FIX 1 — `useRSVP.ts` › `checkWaitlistStatus`

Add `requestedGuests: number` parameter. Replace the seat check so the requesting party's size is included:

```ts
async function checkWaitlistStatus(
  eventId: string,
  currentUserId: string,
  requestedGuests: number,
): Promise<boolean>
// ...
if (confirmed + requestedGuests <= capacity) return false;
```

Update the call site in `createRSVP.mutationFn`:

```ts
const isWaitlisted = input.forceAttending
  ? false
  : await checkWaitlistStatus(eventId, user.id, input.guests_count);
```

## FIX 2 — `useRSVP.ts` › `updateRSVP`

Before applying the update, if `input.guests_count` exceeds the user's existing `guests_count`, recompute available seats and block when the new party doesn't fit. Implementation outline:

1. Fetch the existing rsvp row (or use the diff between old and new) to know the delta.
2. Read `events.capacity` and the sum of `guests_count` for `attending` rows excluding the current user's row.
3. Compute `remaining = capacity - confirmedOthers`.
4. If `input.guests_count > remaining`:
   - Throw `new Error(\`Not enough seats — only ${Math.max(0, remaining)} spots remaining\`)`.
5. The existing `onError` handler will surface that message via `toast.error`.
6. No silent waitlist move; status stays `attending` for successful updates.

Edits where guests stay the same or decrease are unaffected.

## FIX 3 — `RSVPModal.tsx`

In the `createRSVP.mutateAsync` call (around line 267), compute `isOver` from the data already in scope (`allRsvps`, `event.capacity`, `event.waitlist_capacity`) — the same shape as the existing admin-override banner — and pass:

```ts
forceAttending: isAdminOrMod && isOver,
```

`isOver` = attending headcount ≥ capacity AND (waitlist disabled OR waitlist full). Reuse the inline calculation already present in the banner block (lines 324–338) by hoisting it into a single `isOver` const just above the return.

No other behaviour changes; admins on non-full events flow through `checkWaitlistStatus` normally and land as `attending` because seats exist.

## FIX 4 — `WalkInRsvpModal.tsx`

- Import `useEventRsvpCounts` from `@/hooks/useRSVP`.
- Also fetch the event's `capacity` (small `useQuery` on `events` for `capacity`, enabled when `open`), since counts alone don't expose it.
- When `attending_count >= capacity` (and capacity is set), render a soft amber warning banner above the Confirm button:

  > ⚠️ This event is at capacity (X/Y spots). Adding a walk-in will exceed the limit.

- The Confirm button stays enabled; mutation logic is untouched.

Styling: reuse the same yellow alert pattern used in `RSVPModal.tsx` (border-yellow-500/40, bg-yellow-50, AlertTriangle icon) for visual consistency.

---

## Validation checklist (manual, after implement)

1. Non-admin RSVPs to a full Thursday Gathering → row inserted with `status='waitlisted'`, `is_waitlisted=true`; appears in Waitlist section.
2. Member edits existing RSVP from 2 → 6 on a near-full event → blocked with toast `Not enough seats — only N spots remaining`; no DB write.
3. Admin RSVPs to an event with seats remaining → row inserted with `status='attending'` (no forced override path taken).
4. Admin RSVPs to a full + full-waitlist event → forced `attending` via existing override path (banner shown).
5. Walk-in modal on at-capacity event → amber warning visible, Confirm still works.
