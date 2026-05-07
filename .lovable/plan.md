## Bug
Gender-restricted events (`audience_gender = 'Brothers Only'` or `'Sisters Only'`) currently only show a badge. The RSVP button still works for everyone, so a male member can RSVP a "Sisters Only" event and vice versa.

## Fix
Block RSVP for the wrong gender on both the **UI** (clear feedback) and the **database** (defense in depth). Admins/moderators bypass the restriction so they can manage on members' behalf.

### Data model (already in place)
- `events.audience_gender`: `'Everyone'` | `'Brothers Only'` | `'Sisters Only'`
- `profiles.gender`: `'male'` | `'female'` | `null`

Mapping:
- `Brothers Only` → requires `gender = 'male'`
- `Sisters Only` → requires `gender = 'female'`
- `Everyone` → no restriction

### 1. UI guard — `src/components/EventCard.tsx`

- Compute `isGenderRestricted` from `event.audience_gender` and the current `profile.gender` (read from `useAuth()`).
- Bypass for admin/moderator (they can already RSVP others via WalkInRsvpModal).
- When restricted and not attending:
  - Replace the RSVP / Join Waitlist button with a disabled button labeled `Brothers Only` or `Sisters Only` (matching the badge).
  - Show a small muted helper line: `This gathering is for sisters only.` / `…brothers only.`
- When the user is already attending (e.g. legacy RSVP, or admin-added), keep Edit RSVP / View Ticket visible — don't strand them.
- If `profile.gender` is null, treat as restricted (force them to set gender in profile first) and show: `Add your gender in your profile to RSVP this gathering.`

### 2. UI guard — `src/components/RSVPModal.tsx`

If the modal is somehow opened for a restricted event (deep link, guest request flow), short-circuit before showing the form: render the same message and a Close button. Prevents bypass via direct modal open.

### 3. Database guard — trigger on `rsvps`

Add `BEFORE INSERT OR UPDATE` trigger `enforce_event_gender_audience()` (SECURITY DEFINER, search_path public). Logic:
- Skip if caller is admin or moderator (`has_role`) or service role.
- Look up `events.audience_gender` for `NEW.event_id`.
- If `'Brothers Only'`: look up `profiles.gender` for `NEW.user_id`; raise exception unless `'male'`.
- If `'Sisters Only'`: require `'female'`.
- If `'Everyone'` or null: allow.
- Allow updates that don't change `user_id`/`event_id`/`status` from cancelled (so cancellations still work — actually allow any status change as long as gender matches; cancellations are fine because user already passed the check on insert; we just need to not block a cancellation update for an existing row — simplest: only enforce on INSERT, plus on UPDATE only when `event_id` or `user_id` changes).

Error message: `This event is restricted to <brothers|sisters> only.` so the client can surface it via toast.

### 4. RSVP error toast (already in place via mutations)
`useRSVP` mutations show the Postgres error message in a toast. Confirm the new message reads cleanly; otherwise wrap in catch to map to friendly text.

## Out of scope
- No change to event visibility — restricted events still appear on Home for all members (the badge already informs them).
- Dependents: not gated — a brother can still bring a female dependent to a Brothers-Only event if the admin has manually configured it (avoids breaking family use cases).
- Guest requests for restricted events: existing flow unchanged; admin reviews each one.

## Verification
1. As a male member, open a Sisters Only event → RSVP button is disabled with "Sisters Only" label and helper text.
2. Try inserting an RSVP via the admin walk-in modal as a non-admin (shouldn't be possible) — DB trigger blocks it with friendly error.
3. As admin, RSVP a male member into a Sisters Only event via Walk-In → succeeds (admin bypass).
4. As a female member, RSVP a Sisters Only event → works normally.
5. Member with `gender = null` → sees prompt to set gender; trigger also blocks insert with same message.
6. Existing attendees can still Edit / Cancel their RSVP.
