## Goal
Make guest-request management more discoverable, give admins instant in-app notification of new requests, let members cancel their own requests, and let hosts share event details with guests via WhatsApp.

## 1. In-app notification to admins on new guest request
- DB trigger on `guest_requests` AFTER INSERT (status = 'pending'):
  - Look up every admin (`user_roles.role = 'admin'`) and insert one row per admin into `notifications` with:
    - `title`: "New guest request"
    - `message`: "{requester name} requested {guest name} for {event title}"
    - `type`: `guest_request`
    - `metadata`: `{ event_id, guest_request_id }`
  - Runs as `SECURITY DEFINER` so it bypasses the service-role-only INSERT policy.
- Tap behavior: `Notifications.tsx` already routes by `type` — add a case for `guest_request` that navigates to `/admin` with `state: { tab: "guests" }`.

## 2. Separate "Guests" tab in Admin Dashboard (was buried under Users)
- Add a `"guests"` tab to `ADMIN_TABS` in `AdminDashboard.tsx`, between `users` and `families`, rendering `<AllGuestApprovals />` (the existing moderator component, already sorted by event).
- Remove the "Guest Requests" section from `UserManagement.tsx` (delete the query + rendered block; keep the role-`guest` member stats untouched — those are member-role guests, not external guest requests).
- Tab label: "Guests" with `UserPlus` icon and a red badge showing total pending guest requests (new lightweight hook `usePendingGuestRequestsCount` mirroring `usePendingUsersCount`, counting `guest_requests` where `status = 'pending'`).

## 3. Members can cancel their guest requests
- `GuestRequestsSection.tsx`: on each row in "My Guests", show a small trash/X button next to the status badge for requests that are `pending` or `approved` (already-rejected stays read-only).
- `useGuestRequests.ts`: add `useCancelGuestRequest` mutation that `DELETE`s the row (RLS already permits the requesting user to delete their own — verify and add policy if missing).
- Confirm via a simple `confirm()` dialog: "Cancel guest request for {name}?". On success invalidate `my-guest-requests` + admin guest queries.
- If status was `approved`, also show a small toast reminding the admin will be notified (optional: insert a notification row of `type: guest_cancelled` for admins via the same trigger pattern — out of scope unless requested).

## 4. Home Screen quick-action button → Guests panel
- In `AdminQuickActions.tsx`, add a new `QuickActionCard`:
  - Icon: `UserPlus` (or `Users`), label "Guest Requests"
  - Badge: pending guest-request count (uses `usePendingGuestRequestsCount`)
  - `onClick`: `navigate("/admin", { state: { tab: "guests" } })`
- Fills the empty grid slot shown in the screenshot.

## 5. Move "Manage Guests" off the EventCard top
- `EventCard.tsx`: remove the standalone "Guests: X pending — Manage" pill currently sitting above the title.
- Replace with a discreet inline action inside the existing RSVP action row, next to "Edit RSVP" / "View Ticket": a ghost `Button` with a `UserPlus` icon labelled "My Guests" + small badge `(X)` when the user has requests. Tapping opens the same RSVP modal scrolled to the Guests section (existing behavior).
- Visual: matches the parchment/emerald button styling of the surrounding actions — no orange pill above the title.

## 6. Share via WhatsApp from guest approval
- `AllGuestApprovals.tsx` and `AdminGuestApprovals.tsx`: on each approved request (and pending row as a secondary action), add a green WhatsApp icon button.
- Behavior: build a message
  ```
  As-salāmu ʿalaykum {guestName}! You're invited to {eventTitle} on {eventDate}.
  📍 {locationName}
  {address}
  🗺 {mapUrl}
  {eventLink ? `🔗 Join online: ${eventLink}` : ""}
  ```
  and open `https://wa.me/{phone}?text={encoded}` in a new tab when `guest_phone` exists; if no phone, fall back to `https://wa.me/?text=...` (lets host pick recipient).
- Helper: extract `buildGuestWhatsAppMessage(event, guest)` into `src/lib/share-event.ts` so both admin guest panels reuse it.

## Out of scope
- No changes to the email templates, walk-in flow, or member-role "guest" accounts in UserManagement.
- No push notifications — in-app only.

## Technical notes
- **Migration order**: trigger function `notify_admins_on_guest_request()` (SECURITY DEFINER, search_path = public) → trigger `trg_notify_admins_on_guest_request AFTER INSERT ON public.guest_requests`. No new tables.
- **Types**: regenerated Supabase types not needed (only inserts via trigger).
- **`AllGuestApprovals` query** already returns `events.location`, `address`, `virtual_link`, `online_link` — reuse for WhatsApp message.
- **Files touched**: `supabase/migrations/<new>.sql`, `src/pages/AdminDashboard.tsx`, `src/components/AdminQuickActions.tsx`, `src/components/admin/UserManagement.tsx`, `src/components/admin/AllGuestApprovals.tsx`, `src/components/admin/AdminGuestApprovals.tsx`, `src/components/EventCard.tsx`, `src/components/rsvp/GuestRequestsSection.tsx`, `src/hooks/useGuestRequests.ts`, new `src/hooks/usePendingGuestRequestsCount.ts`, `src/lib/share-event.ts`, `src/pages/Notifications.tsx`.
