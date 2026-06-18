## Goal
Make a clear visual + numerical distinction everywhere between:
- **Members/Mureeds** — internal RSVPs (profile.role = approved/admin/moderator, optionally `is_mureed`)
- **External Guests** — approved `guest_requests` (member-sponsored) + admin walk-in guests

## Definition
"External guests" per event = count of `guest_requests` with `status = 'approved'` for that event (this already covers both member-sponsored approvals AND walk-in additions, since walk-ins are inserted as auto-approved `guest_requests`).

"Members/Mureeds" = distinct attending RSVP profile-holders. Mureeds get an extra badge when `profiles.is_mureed = true`.

## Changes

### 1. `src/components/admin/EventRsvpDetail.tsx` — Guest List tab
Split the current single "Guest List" table into two clearly-labeled sections inside the existing tab:
- **Members & Mureeds** — current attending RSVP table. Add a small `Mureed` badge (gold) next to the name when `profile.is_mureed`. Header pill shows `N members · M mureeds`.
- **External Guests** — new table listing approved `guest_requests` for this event with columns: Guest Name, Sponsor (requesting member or "Walk-in" when `requesting_user_id` is null OR equals an admin acting at the door), Phone, Checked-in status. Header pill shows total count.

Pull approved guests from the existing `useEventGuestRequests(eventId)` hook (already imported), filtered to `status === 'approved'`.

### 2. `src/components/admin/EventRsvpDetail.tsx` — Header summary line
Replace the current `Total: X attending` line with a two-part summary:
`Members: N (M mureeds) · External guests: G · Total headcount: N+G`

### 3. `src/components/admin/AdminDoorScanner.tsx` — Check-in badges
On each row in the door scanner list, add a colored tag:
- `Member` (emerald outline) for RSVP-based rows
- `Mureed` (gold) overlay when `is_mureed`
- `Guest` (parchment/secondary) for rows that originate from a `guest_requests` entry (walk-in or sponsored)

Also: in the per-event summary already shown at the top of the scanner, show split counts `Members checked in: X/Y · Guests: G`.

### 4. `src/components/admin/AllGuestApprovals.tsx` — Comparison context
On each event's collapsible header (next to the existing "pending" / "total" badges), add a small subtle pill: `M members RSVP'd` so admins can compare guest volume vs member attendance per event. Members count fetched per event via a lightweight aggregate query (reuse `get_event_rsvp_counts` RPC).

### 5. `src/components/EventCard.tsx` — Admin/host view only
Where current RSVP count is shown for admins/hosts, swap to `N members · G guests`. Members-only view is unchanged.

## Data sources (no schema changes)
- Members count + mureed flag: `rsvps` joined with `profiles` (already loaded).
- External guests count: `guest_requests` where `event_id = ?` and `status = 'approved'`.
- Walk-in vs sponsored differentiation: a guest is "walk-in" when `requesting_user_id` is an admin/moderator AND inserted via the WalkInGuestDialog — currently the dialog sets `requesting_user_id` to the admin's id. We'll label as **Walk-in** when the requester has `admin`/`moderator` role, otherwise show the sponsor's name. (No DB change; resolved client-side via the `profiles` join already used.)

## Out of scope
- `guests_count` field on RSVPs (extra +N people members bring on their own RSVP) is NOT counted as external guests, per the chosen definition. It stays inside the member's row as today.
- No database migrations required.

## Verification
- Open an event RSVP detail as admin → see two labeled sections with correct counts; mureed badge appears for mureed members.
- Open the door scanner → each row tagged Member / Mureed / Guest; header shows split counts.
- All Guest Approvals tab → each event card shows member RSVP count alongside pending/total guest pills.
- Event card (admin view) → shows `N members · G guests` instead of single number.
