## Goal

When an event is published, email all approved members 20 minutes later with the pre-RSVP info and a deep link. On event day, send 24h, 12h, and 2h reminders.

## 1. Database

Add to `public.events`:
- `announcement_send_at timestamptz` — when the announcement email should fire (publish_time + 20 min).
- `announcement_sent_at timestamptz` — set when sent, prevents duplicates.

Add a row to `event_reminders_sent.reminder_type` allowed values: `'12h'` (alongside existing `'24h'`, `'2h'`).

## 2. New email template

`supabase/functions/_shared/transactional-email-templates/event-announcement.tsx`
- Pre-RSVP info only: title, cover photo, date/time (recipient-friendly format), location (or "Online" if virtual-only), event type, host name, short description.
- Excludes: zoom link, address details, check-in PIN, capacity internals.
- CTA button → deep link `https://zawya.app/event/{short_code}` (RSVP page).
- Register in `registry.ts`.

## 3. Trigger the 20-min delay

In code paths that publish an event (set `published: false → true`):
- `src/components/admin/event-form/EventFormTabs.tsx` (manual Save/Publish)
- `supabase/functions/auto-publish-events/index.ts` (scheduled auto-publish)
- Any admin toggle that flips published

Set `announcement_send_at = now() + interval '20 minutes'` and clear `announcement_sent_at` only on the first publish (if `announcement_sent_at IS NULL`). Subsequent re-saves of an already-published event do nothing.

## 4. New scheduled edge function: `send-event-announcements`

Runs every minute via pg_cron. Logic:
1. Select events where `published = true AND announcement_send_at <= now() AND announcement_sent_at IS NULL`.
2. For each: load approved members (`user_roles.role = 'approved'`) joined with `profiles` where `notification_preferences.events != false` and email present.
3. Invoke `send-transactional-email` per recipient with `event-announcement` template, idempotency key `event-announce-{event_id}-{user_id}`.
4. Stamp `announcement_sent_at = now()`.

Edits in the 20-min window are naturally included — template renders from current DB state at send time.

Cron job added via `supabase--insert` (user-specific URL/key).

## 5. Update `send-event-reminders`

Add a third window: `{ type: '12h', hoursAhead: 12, bufferMinutes: 10 }` alongside existing 24h and 2h. Existing `event_reminders_sent` dedupe logic already handles per-window deduping. Email template `event-reminder` already accepts `reminderType`; extend its type union to include `'12h'` and update the human label ("12 hours").

## 6. Out of scope

No changes to RSVP flow, in-app notifications, guest emails, or unrelated UI. Existing `notify_on_event_cancelled` and other emails remain untouched.

## Files

- migration: add `announcement_send_at`, `announcement_sent_at` columns
- `supabase/functions/_shared/transactional-email-templates/event-announcement.tsx` (new)
- `supabase/functions/_shared/transactional-email-templates/registry.ts` (register)
- `supabase/functions/_shared/transactional-email-templates/event-reminder.tsx` (add 12h label)
- `supabase/functions/send-event-announcements/index.ts` (new)
- `supabase/functions/send-event-reminders/index.ts` (add 12h window)
- `supabase/config.toml` (register new function with `verify_jwt = true`)
- `src/components/admin/event-form/EventFormTabs.tsx` (set `announcement_send_at` on publish transition)
- `supabase/functions/auto-publish-events/index.ts` (set `announcement_send_at` on auto-publish)
- pg_cron job for `send-event-announcements` every minute (and verify reminder cron exists)
