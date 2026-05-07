## Goal
When an admin increases an event's capacity, automatically promote the oldest waitlisted RSVPs into the new open spots, notify them in-app, and email them — mirroring the behavior that already happens when an attendee cancels.

## Approach
Add a Postgres trigger on `events` that fires AFTER UPDATE when `capacity` changes. It promotes waitlisted RSVPs (oldest first, FIFO by `created_at`) until attending count reaches the new capacity, sends in-app notifications, and calls the existing `send-transactional-email` edge function with the `event-reactivated` template — reusing the same pattern already proven in `promote_waitlisted_on_cancel`.

No client/UI changes required. The capacity field in the admin form already saves via a normal `UPDATE` and invalidates queries, so the EventCard counter refreshes automatically.

## Changes

### 1. Database migration — new function + trigger
- `promote_waitlisted_on_capacity_increase()` — SECURITY DEFINER plpgsql function that:
  - Runs only when `NEW.capacity IS DISTINCT FROM OLD.capacity` AND `NEW.capacity > COALESCE(OLD.capacity, 0)` (skip on decrease/unlimited→limited edge cases where no promotion is needed).
  - Computes available slots = `NEW.capacity - current attending count`.
  - Loops through waitlisted RSVPs ordered by `created_at ASC` with `FOR UPDATE SKIP LOCKED`, promoting up to N rows.
  - For each promoted RSVP: insert into `notifications` (respecting `rsvp` preference) and POST to `send-transactional-email` via `net.http_post` using `event-reactivated` template, exactly as `promote_waitlisted_on_cancel` does.
- Trigger `trg_promote_waitlisted_on_capacity_increase` AFTER UPDATE OF capacity ON `events`.

### 2. No code changes
- `EventFormTabs` already updates `capacity` and invalidates `admin-events` + `events` queries.
- `EventCard` reads `event.capacity` for the spots counter — refreshes on invalidation.
- Decreasing capacity remains non-destructive (no rows touched); UI may show `count > capacity` until natural cancellations occur.

## Edge cases
- Capacity unchanged → trigger no-op.
- Capacity decreased → trigger no-op (no promotions, no deletions).
- New capacity ≤ current attending → no slots available, no promotions.
- Fewer waitlisted than open slots → promotes all available.
- Email failures are swallowed (matches existing behavior); in-app notification still sent.

## Verification
1. Create test event with capacity=2, waitlist_capacity=5. RSVP 4 users (2 attending, 2 waitlisted).
2. In admin, change capacity from 2 → 4 → save.
3. Check `rsvps`: both waitlisted rows now `status='attending'`, `is_waitlisted=false`.
4. Check `notifications`: 2 new "You're In!" rows.
5. Check `email_send_log`: 2 new `event-reactivated` rows.
6. Reload event card → shows `4/4 spots`.
7. Decrease capacity 4 → 3 → no row changes; counter shows `4/3`.
