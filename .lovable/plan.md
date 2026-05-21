# Guest request visibility + context note

Two improvements to the guest-request flow so members and admins can act faster.

## 1. Show guest-request status on the event card

Today, the only place a member can see whether their guest was approved/rejected is by tapping **Edit RSVP** and scrolling to the Guests section. We will surface a compact summary directly on the event card on the home feed.

**What the member sees on the card (only if they have any guest requests for that event):**

- A small row under the existing status chips, e.g.:
  - `Guests: 1 pending` (amber)
  - `Guests: 2 approved` (emerald)
  - `Guests: 1 approved · 1 rejected` (mixed → neutral with colored dots)
- Tapping the row opens the Edit RSVP modal scrolled to the Guests section, same as today.

**Behavior:**

- Hidden entirely when the member has no guest requests for that event.
- Updates live when status changes (admin approves/rejects).
- Works on both upcoming and past tabs.

## 2. Add a "Notes for the admin" field to guest requests

Currently the member only submits name / email / phone. Admins have no context to decide on borderline cases. We'll add an optional free-text note (e.g. *"Family friend visiting from Cairo, has been to two previous gatherings"*).

**Member side (RSVP modal → Request a Guest form):**

- New optional `Notes for the admin` textarea below the phone field, ~300 char limit, placeholder hint about what's useful (relationship, why they'd like to bring them, etc.).
- Displayed back to the member in their guest list (collapsed, expandable) so they remember what they wrote.

**Admin side (Event Control Room → Guest Approvals, and the global All Guest Approvals view):**

- Show the note inline under the guest's contact details in a softly-bordered block when present.
- Searchable along with name/email in the global list.

## Technical details

**Database:**

- Add column `member_note text` (nullable) to `public.guest_requests`.
- No RLS changes needed (existing policies already cover the row).

**Frontend:**

- `useGuestRequests.ts`
  - `useCreateGuestRequest` accepts `member_note?: string`.
  - New `useBatchMyGuestRequests(eventIds)` that fetches the current user's guest requests for many events in one call and hydrates each event's per-event cache (mirrors the batch pattern already used in `HomeFeed` for RSVPs/speakers/potluck).
- `HomeFeed.tsx` — call the new batch hook with `eventIds` so cards render without an extra fetch each.
- `EventCard.tsx` — read the cached `["my-guest-requests", eventId, userId]` query, compute a `{pending, approved, rejected}` summary, render the new status row. Clicking it triggers the existing "Edit RSVP" handler.
- `GuestRequestsSection.tsx`
  - Add `member_note` textarea to the form.
  - Render the saved note under each existing guest row.

**Admin views:**

- `AdminGuestApprovals.tsx` and `AllGuestApprovals.tsx` — render `member_note` when present.

## Out of scope

- No changes to approval emails or webhooks.
- No new notification when status changes (existing trigger `on_guest_request_update` already fires).
- No edit/delete of the note after submission (keeps the audit simple).
