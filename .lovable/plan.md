## Goal
Auto-hide cancelled events from members' Home feed 24 hours after they are cancelled. Admins still see them in the admin panel.

## Changes

### 1. Database migration
- Add `cancelled_at timestamptz` column to `public.events` (nullable).
- Backfill: for existing rows with `status='cancelled'`, set `cancelled_at = COALESCE(updated_at, now())` so old cancellations disappear immediately.
- Create trigger `set_events_cancelled_at`: on `BEFORE UPDATE`, when `status` transitions to `'cancelled'` set `cancelled_at = now()`; when it transitions away from `'cancelled'` clear it to `NULL` (so re-activating a cancelled event resets the 24h window).

### 2. Home feed filter (`src/pages/HomeFeed.tsx`)
- In both event fetch queries (lines 43 and 54), keep `status in (active, full, cancelled)` but add an OR filter so cancelled events only appear if `cancelled_at > now() - interval '24 hours'` (using `.or("status.neq.cancelled,cancelled_at.gt.<iso>")`).
- Same treatment for any other member-facing lists that show cancelled events (EventCard next-up, RSVP modal event lookup) — I'll verify during implementation and mirror the filter where needed.

### 3. Admin views
- No change. Admin panel continues to show all cancelled events in the "Cancelled Events" section indefinitely.

## Technical notes
- 24-hour threshold is computed client-side at query time from `Date.now()` so no cron/edge function is required.
- Cancelled events the user already RSVP'd to are also hidden after 24h (consistent with removing them from the Home feed entirely). Their RSVP records remain in the DB for admin records.
