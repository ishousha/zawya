## Goal
Add native short links for events: `https://zawya.app/e/Ab3X9z` instead of long UUID URLs, so admins can share clean links via WhatsApp.

## 1. Database (migration)
- Add column `short_code TEXT UNIQUE` to `events` (nullable initially so we can backfill).
- Add a `gen_event_short_code()` SQL function that loops generating a random 6-char alphanumeric (alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` — drop look-alikes `IO01l`) until it finds an unused value, then returns it.
- Add a `BEFORE INSERT` trigger on `events` that sets `short_code = gen_event_short_code()` when it is NULL.
- Backfill: `UPDATE events SET short_code = gen_event_short_code() WHERE short_code IS NULL;` (loop-safe via the function).
- After backfill, `ALTER COLUMN short_code SET NOT NULL`.

No RLS change needed — `short_code` rides on existing event SELECT policies. The lookup route only resolves codes for events the caller can already see; unauth users get redirected to login first (see §3).

## 2. Resolver (no edge function needed)
- The client resolves `short_code → event id` directly via Supabase from the new route. We do NOT expose an unauthenticated lookup, which keeps event existence private.
- For unauthenticated users hitting `/e/:code`, the existing deep-link capture redirects them to login, then resolves after auth.

## 3. Routing — `/e/:shortCode`
New file `src/pages/EventShortLinkRedirect.tsx`:
- On mount, if no session → save `/e/:code` to `sessionStorage` (so post-login redirect re-runs the resolve), render Login.
- If session present → `select id from events where short_code = :code` (single row).
  - Found → `navigate('/events/' + id, { replace: true })`.
  - Not found / error → `toast.error("Event link invalid.")` and `navigate('/', { replace: true })`.

Wire into `AppRoutes.tsx`:
- Unauth branch: `<Route path="/e/:shortCode" element={<LoginPage />} />` (deep link captured via `useCaptureDeepLink`).
- Auth branch (inside `StableLayout` non-tab routes): `<Route path="/e/:shortCode" element={<EventShortLinkRedirect />} />`.

Update `isSafeRedirectPath` to also allow `^/e/[A-Za-z0-9]{4,12}(\?.*)?$` and update `useCaptureDeepLink` (it already uses `isSafeRedirectPath`, so just widening the regex is enough).

## 4. Share URL — admin "Copy Link" / Share Event
- Update `src/lib/share-event.ts`:
  - `getEventShareUrl(event: { id: string; short_code?: string | null })` returns `${origin}/e/${short_code}` if present, else falls back to `/events/${id}`.
- Update all callers to pass the event object (not just id):
  - `src/pages/EventDetail.tsx` — already has `event`, pass `event` to `openShare`.
  - `src/components/ShareEventDialog.tsx` — change `useShareEvent.open(eventOrId, title)` signature to accept the event object (or `{ id, short_code, title }`).
  - `src/components/admin/EventControlRoom.tsx` — pass the event row when invoking share/copy.
- Add `short_code` to `EVENT_PUBLIC_COLUMNS` (`src/lib/event-columns.ts`) so list/detail queries hydrate it.

## 5. QA checklist (after implementation)
1. Create a new event → confirm `short_code` is auto-set (6 chars, unguessable alphabet).
2. Existing events have backfilled codes.
3. Admin "Share Event" copies `https://zawya.app/e/<code>`.
4. Pasting the link in a fresh browser → login screen, then after auth → lands on `/events/:id`.
5. Already-logged-in user opening `/e/<code>` → instant redirect to event detail.
6. Bad code (`/e/zzzzzz`) → toast "Event link invalid." + Home.

## Out of scope
- Custom vanity codes (admin-chosen). Codes are auto-only.
- QR ticket payloads (still use UUID — they're scanned by staff, not shared).
- Email templates (continue to use full event URLs unless you ask to switch them too).
