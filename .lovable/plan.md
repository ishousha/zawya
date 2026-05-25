# Fix Waitlist Bypass Bug

## Root cause

In `src/hooks/useRSVP.ts`, `checkWaitlistStatus()` excludes the current user's existing RSVP when counting confirmed attendees (`.neq("user_id", currentUserId)`). When a waitlisted user re-submits or edits their RSVP, their own seats are subtracted from the confirmed total, so the check thinks there is room and writes `status: "attending"`. This lets waitlisted users self-promote, which is how attending ended up at 82/70.

A secondary issue: `updateRSVP` lets a waitlisted user grow their party with no waitlist→attending re-evaluation, and the RSVP modal does not stop a user from selecting a party size that exceeds remaining capacity (it silently switches to waitlist or, due to the bug above, lets them through).

No schema, SQL, or migration changes. Frontend only. Existing `promote_waitlisted_on_cancel` trigger handles FIFO promotions.

## Changes

### 1. `src/hooks/useRSVP.ts` — fix capacity math in `checkWaitlistStatus`

- Remove the `.neq("user_id", currentUserId)` filter on the attending-count query. Count ALL `status = 'attending'` rows for the event (true confirmed total).
- Subtract only the caller's currently-`attending` seats (look up their own RSVP once and subtract `guests_count` if `status = 'attending'`). Waitlisted/cancelled rows contribute 0.
- Same correction for the waitlist count: count all `status = 'waitlisted'` rows, then subtract 1 if the caller is currently waitlisted.
- Result: a waitlisted user re-submitting is correctly treated as needing a confirmed seat from the leftover capacity, not "promoted" because their own seats were ignored.

### 2. `src/hooks/useRSVP.ts` — guard `updateRSVP`

- If the existing row is `waitlisted`, do not silently flip to attending. Re-run the same capacity check; if confirmed + new guests ≤ capacity, allow update to `attending` only when the user was already attending. Otherwise keep `status: 'waitlisted'` and `is_waitlisted: true` on update.
- Keep the existing "no extra seats" error for attending users who try to grow past capacity.

### 3. `src/components/RSVPModal.tsx` — enforce status in the submission payload and UI

- Compute `confirmedAttending`, `waitlistedTotal`, `remainingSeats = max(0, capacity - confirmedAttending)`, `waitlistRoom = max(0, waitlist_capacity - waitlistedTotal)` from `allRsvps` (already loaded) and `event`.
- Clamp the guest stepper: max selectable = `remainingSeats` when there is room, otherwise `1` for waitlist. Show inline helper: "Only N seats left — larger parties will join the waitlist" or "Event full — joining waitlist".
- Disable submit (and surface "Event & Waitlist Full") when `remainingSeats === 0 && waitlistRoom === 0` and the user is not an admin override.
- Pass `forceAttending` only for true admin override (already handled). Otherwise rely on the corrected hook to set `status`/`is_waitlisted`.

### 4. `src/components/EventCard.tsx` — capacity display + button state

- Capacity chip: show `min(confirmedCount, capacity)`/`capacity` is NOT desired — instead keep raw `confirmedCount/capacity` but color it destructive when over. (Already correct; no change beyond verifying it reflects the RPC count.)
- Button: already shows "Waitlist Full" / "Event Full" disabled when `waitlistFull` or `noWaitlist`. No change needed here once the hook stops over-filling attending; verify after fix.

## Validation

1. As a waitlisted user, open RSVP modal and re-submit with same party size → must remain `waitlisted`.
2. As a waitlisted user, edit party size up or down → must remain `waitlisted`.
3. As a new user when capacity is full and waitlist has room → payload sends `status: 'waitlisted'`, `is_waitlisted: true`; toast says "Added to the Waitlist".
4. As a new user when capacity and waitlist are both full → button disabled, label "Event & Waitlist Full".
5. As a new user choosing a party size larger than remaining seats → stepper caps, helper text explains waitlist fallback.
6. Admin override path still works when both are full (existing behavior).
7. No DB writes outside `rsvps` and `rsvp_sign_up_selections`; no migration.

## Out of scope

- Backfill of the existing 12 over-cap attending rows. We can address that separately (e.g., admin tool to demote latest-by-`created_at` to waitlist) once the leak is closed.
