## Bug
Events disappear from the Home "Upcoming" tab the moment their end time passes. Late-arriving members lose access to the event card (and the self check-in button along with it).

## Fix
Keep events on Home for **60 minutes after they end**, so members can still see them, view their ticket, and self check-in if they arrive late.

### 1. `src/pages/HomeFeed.tsx` — upcoming/past split

Replace the time filter in both branches of the `events` query:

- **Upcoming** currently includes events where `end_date_time >= now` OR (no end and `date_time >= now - 4h`). Change to:
  - `end_date_time >= now - 60 min`, OR
  - (no `end_date_time` AND `date_time >= now - 60 min`)
- **Past** is the inverse:
  - `end_date_time < now - 60 min`, OR
  - (no `end_date_time` AND `date_time < now - 60 min`)

This keeps an event on Home for a full hour after the scheduled end (or after the start time if the event has no end set — admins should set an end time, but we degrade gracefully).

### 2. `src/lib/prefetch.ts` — match Home cutoff

`prefetchHome` uses the same 4-hour fallback. Update it to the new 60-minute grace so the prefetched cache matches what HomeFeed actually queries (avoids a flicker).

### 3. `src/components/EventCard.tsx` — check-in stays available during grace

The card already opens self check-in via `SelfCheckinModal` when `isCheckinActive` (2 h before start, no upper bound). Currently when `isPast=true` the card collapses to a "Past Event" / "Watch Recording" footer and hides Edit RSVP / View Ticket / check-in.

With the new cutoff, late-arrival cards stay on the Upcoming tab, so the existing check-in flow naturally works for the full 60-minute grace — no logic change needed inside the card itself, just confirm:
- `isLiveNow` calculation (`now < endTime`) still drives the "Live now" badge correctly during the actual event window.
- After the event ends but before the 60-min cutoff, the card simply shows the normal RSVP/Ticket/check-in actions (no "Past Event" UI yet).

No change to the Past tab behavior — once an event is more than 60 min past its end, it moves there as before.

### Out of scope
- No DB schema changes.
- No change to RSVP RLS, reminders, or check-in PIN logic.
- Admin views and EventDetail pages unchanged.

### Verification
1. With an event whose `end_date_time` is 30 min in the past: card still appears on Upcoming, shows ticket + check-in.
2. Same event 61 min after end: moves to Past tab.
3. Event with no `end_date_time`, started 30 min ago: stays on Upcoming. 61 min after `date_time`: moves to Past.
4. Live event during its window: still shows "Live now" badge.
