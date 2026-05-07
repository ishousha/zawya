## Bug
Non-admin members see `0/50 spots` and `0/N claimed` for every potluck item, even though 51 guests have RSVP'd and 26 selections exist. Admins see correct numbers.

## Root cause
`rsvps` RLS only exposes a user's own row (plus full access for admins/mods/hosts). The client-side hooks aggregate counts from `rsvps` directly:

- `useEventRSVPs` → returns ≤1 row for a regular member → `EventCard` computes `confirmedCount = 0` → shows `0/50 spots`, no waitlist messaging.
- `useEventSelections` → first queries `rsvps` for ids (returns nothing) → never fetches the selections that the broader `rsvp_sign_up_selections` SELECT policy would actually allow → every item reads `0/N claimed`.

We can't simply broaden `rsvps` RLS — those rows contain PII (user_id, dependents, food prefs, qr_hash). Need server-side aggregation.

## Fix
Add two `SECURITY DEFINER` RPCs that return only aggregate, non-PII data, then use them on the member-facing card and RSVP modal.

### 1. DB migration — two RPCs

**`get_event_rsvp_counts(_event_id uuid)`** returns one row:
- `attending_count` (SUM of `guests_count` where status='attending')
- `attending_rsvp_count` (COUNT)
- `waitlisted_count` (COUNT where status='waitlisted')
- `checked_in_count` (SUM of guests_count where checked_in)

Visibility check inside the function: caller must be admin/moderator/host of the event, OR the event is `published=true` AND the caller has role `approved`/`guest` (mirroring existing `get_event_potluck_menu` pattern). Returns zeros otherwise.

**`get_event_signup_claims(_event_id uuid)`** returns rows: `sign_up_item_id bigint`, `total_quantity int`. Same visibility check.

Both functions: `STABLE`, `SECURITY DEFINER`, `SET search_path = public`. `GRANT EXECUTE TO authenticated`.

### 2. Hook updates (`src/hooks/useRSVP.ts`)

- Add `useEventRsvpCounts(eventId)` calling `supabase.rpc("get_event_rsvp_counts", { _event_id })`.
- Add `useEventSignUpClaims(eventId)` calling `supabase.rpc("get_event_signup_claims", { _event_id })`.
- Keep `useEventRSVPs` and `useEventSelections` unchanged (still used by admin/host dashboards which need full rows).
- Invalidate the new query keys inside `invalidateAll()` in `useRSVPConcurrency`.

### 3. EventCard (`src/components/EventCard.tsx`)

Replace `useEventRSVPs` usage for the member view with `useEventRsvpCounts`:
- `confirmedCount` ← `counts.attending_count`
- `checkedInCount` ← `counts.checked_in_count`
- `isFull` derivation unchanged (uses `confirmedCount` + `event.capacity`)
- For waitlist position display (current user's place in line), keep the existing logic but compute against `counts.waitlisted_count` as the total — the user's own rsvp gives them their position only when admin loads it; for non-admins, fall back to "You're on the waitlist" without a numeric position. (Acceptable degradation — current numeric position is already broken for non-admins.)

### 4. RSVPModal (`src/components/RSVPModal.tsx`)

Swap `useEventSelections` for `useEventSignUpClaims`. Build `claimedPerItem` from the RPC rows. Subtract the current user's own selections (already fetched via `useMySelections`) so the claimed count shown to them excludes themselves, matching today's behavior.

## Out of scope / unchanged
- Admin `EventRsvpDetail`, `HostDashboard`, `PotluckReclaimReport`, etc. still use `useEventRSVPs`/`useEventSelections` — they have the RLS access they need.
- No changes to `rsvps` RLS (PII stays protected).
- `CurrentMenuPreview`/`PotluckMenu` already work via the existing `get_event_potluck_menu` RPC.

## Verification
1. Log in as a regular approved member, view "Thursday Gathering" — card now shows `51/50 spots` (or capacity-aware label) and waitlist messaging when full.
2. Open RSVP modal — each potluck item shows the correct `X/Y claimed` matching admin view.
3. Log in as admin — admin views remain unchanged.
4. Cancel/create an RSVP — counts and claimed numbers refresh via `invalidateAll`.
