## Bug

Event card shows `35/50 spots` while the Host Dashboard shows `43 Total` for the same event.

**Root cause:** `confirmedCount` in `EventCard.tsx` (line 56) counts the number of attending RSVP **rows**, not the number of **people**. Each RSVP can bring multiple guests (`guests_count`), so the spots indicator under-reports actual occupancy. The waitlist gate (`checkWaitlistStatus` in `useRSVP.ts`) has the same flaw.

The Host Dashboard already calculates headcount correctly by summing adults + dependents.

## Fix

1. **`src/components/EventCard.tsx`** — change `confirmedCount` to sum `guests_count` across attending RSVPs (one number, matches the Host Dashboard "Total" tile). `isFull` and the `35/50 spots` label both use it automatically.

2. **`src/hooks/useRSVP.ts` → `checkWaitlistStatus`** — replace the `count: "exact"` head query with a `select("guests_count")` query and sum the values, so new RSVPs are correctly routed to waitlist when the event is actually full by headcount.

3. Leave Host Dashboard untouched (already correct). No DB or schema changes.

## Verification

- Reload the Thursday Gathering event card → should read `43/50 spots` (matching Host Dashboard).
- Spot-check another event with single-person RSVPs → number should be unchanged.
