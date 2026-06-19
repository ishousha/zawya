## Goal
Help members remember which sign-up items they committed to bring by showing them on (1) their QR ticket screen and (2) the event reminder emails (24h / 12h / 2h).

## Changes

### 1. QR Ticket — show "You're bringing"
File: `src/components/QRTicketScreen.tsx`

- Add a React Query fetch for the current user's sign-up selections for this RSVP, joining `rsvp_sign_up_selections` → `event_sign_up_items` to get `item_name` + `quantity` (and any `description` if present).
- Render a new "Bringing" section in the details block, listing each item as e.g. `Karak ×2` or `Appetizers — Hummus`.
- Keep the existing legacy `rsvp.potluck_category` / `specific_food_item` line as a fallback when no sign-up selections exist.
- Cache the data so it's available offline (same React Query key persisted via the existing offline cache pattern). If offline and uncached, hide the section gracefully.

### 2. Event reminder emails — include sign-up items per recipient
Files:
- `supabase/functions/send-event-reminders/index.ts`
- `supabase/functions/_shared/transactional-email-templates/event-reminder.tsx`

Backend (`send-event-reminders`):
- After loading confirmed RSVPs for each event, also fetch `rsvp_sign_up_selections` joined with `event_sign_up_items` for those RSVP IDs.
- Build a per-user list: `[{ itemName, quantity, description? }]`.
- Pass it as `signUpItems` in `templateData` to `send-transactional-email`. Also include legacy `potluckItem` from `rsvps.specific_food_item` / `potluck_category` as a fallback when no selections exist.
- Idempotency key unchanged (`event-reminder-{eventId}-{userId}-{window}`), so existing reminder-sent guard still prevents duplicates.

Template (`event-reminder.tsx`):
- Add optional `signUpItems?: { itemName: string; quantity: number; description?: string }[]` and `potluckItem?: string` props.
- When present, render a "Don't forget to bring" section between the event details and the footer, styled to match the existing `detailsBox`.
- If both arrays are empty, render nothing (no behavior change for events without sign-ups).
- Update `previewData` with a sample item.

### 3. No DB / migration changes
All needed data already exists in `rsvp_sign_up_selections` and `event_sign_up_items`. RLS already allows users to read their own selections; the edge function uses the service role.

## Out of scope
- Guest-list reminder emails (already list claimed items for admins).
- RSVP confirmation email (separate template, can be a follow-up if desired).
- Push/in-app notifications.

## Technical notes
- After editing the edge function + template, redeploy `send-event-reminders` and `send-transactional-email` so the new template ships.
- Ticket query key suggestion: `["rsvp-signup-items", rsvp.id]` to integrate with existing offline ticket caching.
