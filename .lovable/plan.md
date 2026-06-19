## Problem

1. Members are forced to enter a guest email they often don't know, so they type their own — which means the approval invite goes to the wrong inbox.
2. The "You're invited" email shows the address as plain text with no Google Maps link, so guests can't tap to navigate.

## Fix

### 1. Make guest email optional (member-facing guest request form)

`src/components/rsvp/GuestRequestsSection.tsx`
- Remove the red asterisk on the Guest Email field and drop the "required" validation in `handleSubmit`. Keep format validation only when the field is non-empty.
- Replace the current helper text with: "Optional. If you have it, we'll email the guest their invite once approved. Otherwise, use the *Share Details* button after approval to send them the info via WhatsApp."
- Reorder fields so **Phone** sits directly under Name (phone is what they'll actually use to share) and Email drops below as optional.

`src/hooks/useGuestRequests.ts`
- Allow `guest_email` to be undefined / empty string in the mutation input type and insert payload (column already accepts `""` — walk-in flow uses it).

`src/components/admin/AllGuestApprovals.tsx` — no change needed: the approval-email send is already gated on `gr.guest_email` being truthy, so missing emails simply skip the email step (the in-app "Share Details" button covers that case).

### 2. Add a map link to the guest approval email

`supabase/functions/_shared/transactional-email-templates/guest-approved.tsx`
- Accept two new optional props: `eventAddress` (string) and `mapUrl` (string).
- When `mapUrl` is present, render a gold/emerald "View on Map" `<Button>` directly below the Location row, plus a plain-text fallback link underneath so it survives clients that strip buttons.
- Keep existing styling (parchment card, emerald headings).

`src/components/admin/AllGuestApprovals.tsx`
- Build the map URL when the event has a location/address:
  - `https://www.google.com/maps/search/?api=1&query=<encoded address or location>`
  - Pass `eventAddress: evt.address` and `mapUrl` in `templateData`.
- Skip the field for virtual-only events.

### 3. Deploy

Deploy `send-transactional-email` so the updated template ships.

## Out of scope
- No DB schema change (column already nullable in practice via empty string).
- No change to walk-in guest flow or admin door check-in.
- No change to other email templates.
