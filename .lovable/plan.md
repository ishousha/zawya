## Goal
Let admins add guests to any event from the admin panel — even when "Allow guests" is off on the event — and expose the action from both the **Guests tab** and the **Next Event Guest List** (Event Control Room detail).

## Background
- `WalkInGuestDialog` already exists and inserts an auto-approved `guest_requests` row. The DB insert policy only checks `auth.uid() = requesting_user_id`, so admins can insert regardless of the event's `allow_guests` flag — no DB change needed.
- It is currently only mounted inside the Live Door Scanner.

## Changes

### 1. Admin Guests tab — `src/components/admin/AllGuestApprovals.tsx`
- Track an `addGuestEventId` state.
- In each event group header (the `CollapsibleTrigger` row), add a small "+ Add Guest" button (admin-only context, no allow_guests check) next to the badges. Stop propagation so it doesn't toggle the collapsible.
- Also render the button inside the expanded `CollapsibleContent` (top of the list) so it's reachable when the group is open.
- Mount one `<WalkInGuestDialog eventId={addGuestEventId} open={...} onOpenChange={...} />` at the bottom; on success the existing `all-guest-requests` invalidation already refreshes the list.

### 2. Next Event Guest List — `src/components/admin/EventRsvpDetail.tsx`
- Import `WalkInGuestDialog` and add `showAddGuest` state.
- In the action button row (around line 469, next to "Walk-In"), add a new button: **"Add Guest"** (UserPlus icon, outline variant) that opens the dialog.
- Mount `<WalkInGuestDialog eventId={eventId} open={showAddGuest} onOpenChange={setShowAddGuest} />` alongside the existing `WalkInRsvpModal`.
- No change to allow_guests logic; admins bypass it.

### 3. Copy / UX
- Button label: "Add Guest" with `UserPlus` icon, consistent with the existing Walk-In button styling.
- Inside `WalkInGuestDialog`, keep the existing "Guest will be auto-approved for this event." helper text (already correct).

## Out of scope
- No database/migration changes (insert policy already permits admin inserts).
- No change to member-facing guest request flow or to the event-level `allow_guests` toggle behavior for members.
- No bulk add or CSV import.