## Goal

Fix three RSVP issues:

1. A family member can be counted twice — once via their own RSVP and once as a `family_member` entry inside another family member's RSVP.
2. When a family member already RSVP'd them, the covered user still sees a bare "RSVP" button instead of "RSVP'd" + ticket.
3. The host's own RSVP currently consumes a seat against the event capacity.

## Plan

### 1. Database — prevent duplicate family coverage

New migration (one transaction):

- Add a Postgres trigger `prevent_duplicate_family_rsvp` on `public.rsvps` (BEFORE INSERT OR UPDATE):
  - For the row's `event_id`, look for any other non-cancelled RSVP where `attending_dependents` contains `{"type":"family_member","id":<NEW.user_id>}`. If found, raise `RSVP_DUPLICATE_COVERED` with the covering user's name.
  - For every `family_member` id inside `NEW.attending_dependents`, check that no other non-cancelled RSVP exists for that user on the same event. If found, raise `RSVP_DUPLICATE_MEMBER` with the member's name.
- Add an RPC `get_my_event_coverage(_event_id uuid)` returning `{ covering_rsvp_id, covering_user_id, covering_user_name, qr_hash, status, checked_in }` — finds an active RSVP on the event that lists `auth.uid()` as a `family_member` dependent (or returns null). SECURITY DEFINER, scoped to `auth.uid()`.
- Update RPC `get_event_rsvp_counts` so `attending_count` and `checked_in_count` subtract 1 for the host's RSVP (`events.host_id`), so the host never consumes a public seat. `attending_rsvp_count` stays as-is so totals still reconcile internally.

### 2. Frontend — model "covered by family"

- `src/hooks/useRSVP.ts`:
  - New `useMyEventCoverage(eventId)` calling the new RPC.
  - In `checkWaitlistStatus`, subtract the host's `guests_count` from `totalConfirmed` so the host's seat is not counted against capacity client-side either.
- `src/components/RSVPModal.tsx`:
  - When the user is *covered* (no own RSVP, but covered RSVP exists), render a read-only state: "You're already RSVP'd by {coveringName} for your family." with a "View Family Ticket" button (opens that RSVP's QR ticket) and a "Remove me from this RSVP" link that calls a small mutation removing the user's entry from the covering RSVP's `attending_dependents` (only allowed for self).
  - When the user *is* RSVPing and adds family members, surface the new DB errors as toast messages: "{name} already has their own RSVP — cancel it first" / "{name} is already covered by {other}'s RSVP".
- `src/components/EventCard.tsx`:
  - Treat `myRSVP || coverage` as "attending" for button state.
  - If only `coverage` exists, button label becomes "RSVP'd by {coveringName}" and primary action opens the family ticket (`QRTicketScreen` with the covering RSVP). Cancel/edit actions stay hidden for covered users (they can only "Remove me" via the modal).
  - Host badge: if `event.host_id === user.id`, show a small "Hosting" pill and skip the seat-count messaging that suggests they take a slot.

### 3. Cleanup of existing duplicates

- One-off SQL run (via insert tool, no schema change): for every event, if a user has both their own active RSVP and is listed as a `family_member` in another active RSVP on the same event, cancel the standalone solo RSVP (keep the family-coverage entry) and write an admin activity log row `rsvp_dedupe_auto` so admins can audit. We will preview affected rows first with a SELECT before running the UPDATE.

### Out of scope

No changes to event creation, sign-up items, potluck logic, guest requests, waitlist promotion logic, or notifications beyond the toast messages above.

### Technical notes

- The `attending_dependents` jsonb already uses `{type:'family_member'|'dependent', id}` shape (see `RSVPModal.tsx` lines 70–82), so trigger logic can use `jsonb_path_exists(NEW.attending_dependents, '$[*] ? (@.type=="family_member" && @.id=="<uuid>")')`.
- `get_event_rsvp_counts` is SECURITY DEFINER — host exclusion is a single `LEFT JOIN events e ON e.id = a.id` plus `CASE WHEN r.user_id = e.host_id THEN 0 ELSE ... END`.
- The "Remove me" mutation reads the covering RSVP, filters its `attending_dependents` array, writes it back, and decrements `guests_count` by 1. RLS already allows the covered user… actually it does not — we'll add a policy `Covered user can remove self from family RSVP` on `rsvps` for UPDATE where `attending_dependents @> jsonb_build_array(jsonb_build_object('type','family_member','id',auth.uid()))`, restricted to those two columns via a trigger guard.
