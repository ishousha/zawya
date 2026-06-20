## Problem

1. **RSVP modal (bug):** `GuestRequestsSection` (which contains the "Add Guest" UI) is gated on `isEditing && allow_guests !== false` in `src/components/RSVPModal.tsx:829`. So when a member opens the modal for the first time on a guest-enabled event, no Add Guest UI appears — they have to submit the RSVP, reopen the modal, and only then can they add guests.

2. **Home EventCard:** After RSVP, the only entry point to add a guest is the discreet `GuestRequestStatusRow`, which is rendered only when the user already has at least one guest request (`useMyGuestRequests` returns non-empty). There's no visible "Add Guest" affordance for guest-enabled events between making the RSVP and adding the first guest.

## Changes

### 1. `src/components/RSVPModal.tsx`
- Remove the `isEditing` gate on the Guest Requests block (line 829). Keep the `allow_guests !== false` check.
- Also keep it hidden while the user has no active RSVP yet on first-open *new* RSVPs — but since `GuestRequestsSection` needs an existing RSVP to attach guests to, show it whenever `myRSVP` exists OR show an inline note "Submit your RSVP first to add guests." Simplest: render the section when `(myRSVP || isEditing) && allow_guests !== false`. This covers the bug: any user who has previously RSVP'd (even if not in "edit" mode flow) will see Add Guest immediately.

### 2. `src/components/EventCard.tsx`
- For guest-enabled events (`allow_guests !== false`), when the user is attending (`isAttending`) and is not past/cancelled, always render an "Add Guest" button (outline, small) below the RSVP action row — independent of whether they already have guest requests.
- If they already have guest requests, keep the existing `GuestRequestStatusRow` (with counts) and hide the redundant Add Guest button (status row already opens the modal).
- Clicking opens the RSVP modal (`setRsvpOpen(true)`), where the now-always-visible Guest Requests section lets them add one.

## Out of scope
- No changes to the guest request data model, hooks, or `GuestRequestsSection` internals.
- No admin-side changes.
