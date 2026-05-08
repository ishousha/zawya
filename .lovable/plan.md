# Security Hardening Plan

Fix the 4 open findings before publish. No user-facing behavior change for legitimate flows.

## 1. Gate event credentials (zoom_password, checkin_pin, recording_passcode)

**Problem:** All approved members receive these in every event SELECT, even when UI hides them.

**Fix:**
- New view `events_public` exposing every column **except** `zoom_password`, `checkin_pin`, `recording_passcode`. Apply same RLS rules.
- Switch all client-side reads (`EventDetail.tsx`, `prefetch.ts`, `EventCard`, anywhere that doesn't need the secrets) to select from `events_public` or omit those 3 columns.
- New SECURITY DEFINER RPC `get_event_zoom_credentials(_event_id uuid)`:
  - Returns `{ zoom_password, recording_passcode }` only when caller has a non-cancelled RSVP for that event (no time gate — user requested credentials shown after RSVP).
  - Recording passcode returned only if event has ended.
- `EventCard.tsx` calls this RPC for virtual/hybrid events when user has RSVP'd, replaces `event.zoom_password` reads.
- `checkin_pin` is **never** sent to clients. Existing `verify_checkin_pin` RPC stays. Admin/Moderator UIs (`EventControlRoom`, event form) already use service-role-equivalent admin reads — add a separate RPC `get_event_admin_secrets(_event_id)` gated on `has_role(admin|moderator)` returning all 3 fields for the admin/host UI.
- Update `EventControlRoom.tsx` and `EventFormTabs.tsx` to fetch secrets via this admin RPC instead of the events row.

## 2. Restrict host profile access

**Problem:** "Hosts can view profiles of rsvpd users" policy returns all PII columns.

**Fix:**
- Drop the host SELECT policy on `profiles`.
- Add a SECURITY DEFINER RPC `get_event_attendee_profiles(_event_id uuid)` returning only `id, name, family_name, avatar_url` (no email/phone/DOB/whatsapp/is_mureed) for callers who are the host of that event OR admin/moderator.
- Update `HostDashboard.tsx` to call this RPC. Admin views (`EventRsvpDetail.tsx`) keep direct profile access via the existing admin/moderator policies.

## 3. Harden dependents INSERT/UPDATE

**Problem:** A user with `family_id IS NULL` can claim arbitrary dependents by setting `parent_id = self`.

**Fix:**
- Replace the INSERT policy with: caller must have non-null `family_id` AND `family_id` matches their own, OR caller is admin.
- Replace the UPDATE policy similarly.
- DELETE/SELECT policies stay as-is (they fail safely on NULL).

## 4. Security memory update

Document accepted patterns: event credentials only via gated RPCs, attendee profiles for hosts only via RPC with limited columns, dependents require family membership.

## Technical details

**New DB objects:**
- View: `public.events_public` (all columns except 3 secrets) with appropriate `security_invoker = true` so RLS still applies.
- RPCs: `get_event_zoom_credentials(uuid)`, `get_event_admin_secrets(uuid)`, `get_event_attendee_profiles(uuid)` — all `SECURITY DEFINER`, `STABLE`, `search_path = public`, `EXECUTE` granted only to `authenticated`.

**Client files touched:**
- `src/lib/prefetch.ts` — drop `zoom_password` from select.
- `src/pages/EventDetail.tsx` — drop the 3 secret columns from select.
- `src/components/EventCard.tsx` — fetch zoom credentials via RPC after RSVP confirmed.
- `src/components/admin/EventControlRoom.tsx` — fetch admin secrets via RPC.
- `src/components/admin/event-form/EventFormTabs.tsx` — same.
- `src/components/HostDashboard.tsx` — switch attendee profiles to RPC.

**No data migration needed** — only schema/policy/function changes.

## Out of scope
- No changes to event creation flow, RSVP flow, or email templates.
- No changes to admin reads on `events` (admins continue to see all columns directly via existing admin SELECT policy).
