# Deep Linking for Events

Enable WhatsApp-shareable links to individual events with safe auth redirect, copy-link UI, and graceful 404 handling.

## 1. Routing

The canonical route already exists: `/events/:eventId` (in `AppRoutes.tsx`). We will:

- Keep `/events/:eventId` as the canonical URL (avoids breaking existing in-app navigation that already uses `/events/...`).
- Add a redirect alias `/event/:eventId` → `/events/:eventId` so links shared in either form work. This matches the singular form mentioned in the request without introducing a duplicate page.

## 2. Auth redirect flow

Currently in `AppRoutes.tsx`, unauthenticated users are routed to `LoginPage` for any unknown path, losing the deep link.

Changes:
- When `!session` and the requested path is `/events/:eventId` (or `/event/:eventId`), capture the full path + search and store it as `redirectTo` in `sessionStorage` under key `zawya_post_login_redirect` (sessionStorage survives the OAuth round trip and OTP verification, and is cleared after use). Then render `LoginPage`.
- Add a small `usePostLoginRedirect()` effect inside `AppRoutes` that runs after `session` becomes truthy and `profile` is loaded with role `approved`/`admin`/`moderator`/`guest` (i.e. fully onboarded). If `zawya_post_login_redirect` is set, navigate there with `replace: true` and clear the key.
  - We deliberately do NOT redirect users still in pending/onboarding/guidelines/suspended/rejected states — they finish those gates first; the redirect fires once they land in the StableLayout.
- Skip redirect if the stored path doesn't start with `/events/` (allowlist) to prevent open-redirect abuse.

Note: We use sessionStorage rather than a `?redirectTo=` query param because the existing login flow uses Supabase magic links / Google OAuth that strip arbitrary query params and bounce through external URLs. SessionStorage is the most reliable way to preserve intent across those round trips, and the existing codebase already uses the same pattern for `zawya_family_invite_token`.

## 3. 404 fallback

In `EventDetail.tsx`, the current "Event not found" branch shows a static message. Update it to:
- On `!eventLoading && !event`, fire a `toast.error("This event could not be found or has been removed.")` once and `navigate("/", { replace: true })`.
- Also handle the query `error` case (e.g., RLS denial) the same way so a deleted/unpublished event doesn't crash.

## 4. Share button

Add a "Copy Link" button (with `Link2` lucide icon) in two places:

- **Admin/Moderator/Host view** on the Event Details page (`EventDetail.tsx`) — placed next to the existing Contact Organizer / Host Dashboard area, only visible to admin, moderator, or assigned host.
- **Admin Event list** in `src/components/admin/` — add to the per-event row/card actions in the events tab so admins can copy without opening the event. (Need to verify the exact component during build; likely `EventControlRoom` or the events list inside `AdminDashboard`.)

Behavior:
```
const url = `${window.location.origin}/events/${event.id}`;
await navigator.clipboard.writeText(url);
toast.success("Event link copied to clipboard!");
```
Fallback: if `navigator.clipboard` is unavailable (older browsers / insecure context), use a hidden textarea + `document.execCommand('copy')` and still show the toast; on failure show `toast.error("Could not copy link")`.

## Technical details

Files to edit:
- `src/components/AppRoutes.tsx` — add `/event/:eventId` redirect route, capture deep-link path to sessionStorage when unauthenticated, add `usePostLoginRedirect` hook fired after auth + onboarding gates pass.
- `src/pages/EventDetail.tsx` — replace not-found block with toast + navigate; add Share button for admin/moderator/host.
- `src/components/admin/` — add Share button to the admin events list (exact file confirmed during build).
- No DB changes. No edge function changes. No changes to `Login.tsx` itself (redirect is handled centrally in `AppRoutes`, which is cleaner and works for both OTP and Google flows).

Out of scope:
- Renaming the canonical route from `/events/:eventId` to `/event/:eventId` (would touch many call sites and risk breaking production links already shared).
- OG/social preview meta tags for the shared link (can be a follow-up).