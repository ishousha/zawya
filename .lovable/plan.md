## Goal
Right now the Waitlist is essentially invisible: the admin RSVP detail hides the section when it's empty, and the Host Dashboard Guest List doesn't separate or label waitlisted people. Fix both.

## Changes

### 1. Admin: `src/components/admin/EventRsvpDetail.tsx`
- Always render the **Waitlisted** section on the Guests tab, even when empty.
  - Header shows `Waitlisted (N)`.
  - Empty state: small muted line "No one on the waitlist."
  - Add a shortcut button in the section header: **"Add to Waitlist"** that opens the existing `WalkInRsvpModal` pre-set to waitlist mode (the modal already supports Walk-In / RSVP / Waitlist).
- Also surface the waitlist count in the header capacity chip so admins see `Remaining X / Y · Waitlist N` even when the collapsible list is empty.

### 2. Host Dashboard: `src/components/HostDashboard.tsx`
- Confirm the `get_event_host_rsvps` RPC returns waitlisted rows (it currently does — waitlisted rows have `status='waitlisted'` or `is_waitlisted=true`). If any are filtered out, patch the RPC to include them (status ≠ 'cancelled').
- Split the Guest List into two grouped subsections:
  - **Attending (N)** — current list, unchanged visuals.
  - **Waitlist (N)** — same row layout, tinted amber with a small "Waitlist" chip on each row, no check‑in circle.
- Headcount tiles (Total / Adults / Elders / Kids / Arrived) continue to count **attending only**; waitlisted parties are excluded from those totals so hosts don't over-plan.

### 3. Empty-state polish
- If both attending and waitlist are empty, show the existing "No RSVPs yet." message once, not twice.

## Out of scope
- No schema/RPC changes unless step 2 reveals waitlisted rows are being filtered by `get_event_host_rsvps` (in which case a small SECURITY DEFINER function update is needed to include `status='waitlisted'`).
- No changes to member-facing views.

## Technical notes
- Filters already in place:
  - `attending = rsvps.filter(r => r.status === 'attending' && !r.is_waitlisted)`
  - `waitlisted = rsvps.filter(r => r.status === 'waitlisted' || r.is_waitlisted)`
- `WalkInRsvpModal` accepts an initial mode prop — reuse it for the "Add to Waitlist" shortcut.
- Keep all admin actions (promote, edit, remove) on waitlisted rows as they are today.
