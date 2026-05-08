## Problem

Two issues with event sharing:

1. **Share button shows "Could not copy link"** (confirmed in session replay). The current `copyEventLink` helper relies solely on `navigator.clipboard.writeText`, which is blocked inside the Lovable preview iframe (no clipboard permission) and on some mobile browsers. The `execCommand` fallback also fails because the focused iframe doesn't get a user-activation clipboard grant. Result: nothing visible to the user, no link to copy manually.

2. **Share is only available on EventDetail and the admin Control Room.** Users want to share any upcoming event directly from the events list without opening it first.

The deep-link route itself (`/events/:eventId`) already works — both for authenticated users and for the unauthenticated "login → redirect back" flow in `AppRoutes.tsx`. The bug is purely in the share UX.

## Plan

### 1. Replace `copyEventLink` with a reusable `ShareEventDialog`

New component `src/components/ShareEventDialog.tsx` (shadcn `Dialog`) opened via a small helper/hook. When triggered it:

- Computes the canonical URL using the **published origin** when available (prefer `window.location.origin` if it's not a `*lovable.app` preview/iframe; otherwise fall back to the project's published domain `https://zawya.app`). This guarantees the link works for recipients even when an admin shares from the in-editor preview.
- Tries `navigator.share({ title, text, url })` first on devices that support it (mobile) — single tap to native share sheet.
- On desktop / when Web Share is unavailable, opens a dialog showing:
  - The full URL in a read-only `Input` (auto-selected on focus, tap-to-select on mobile).
  - A "Copy link" button using `navigator.clipboard` with a `textarea + execCommand` fallback, plus a final fallback that simply tells the user "Long-press the link above to copy" if both fail. Toast only on success; never silently fail.
  - Quick share buttons: WhatsApp (`https://wa.me/?text=`), Email (`mailto:`), and (if supported) "Share via…" that re-invokes Web Share.
- Title/description text uses the event title so previews/messages look right.

### 2. Update `src/lib/share-event.ts`

- Keep `getEventShareUrl(eventId)` but make it preview-aware (fall back to production origin when running under `id-preview--*.lovable.app` or `localhost`).
- Remove the silent-failure `copyEventLink`. Export a small `useShareEvent()` hook that returns `{ open, dialog }` so any component can render the dialog and trigger sharing without prop-drilling.

### 3. Wire the new share UX everywhere

- **`src/pages/EventDetail.tsx`** — replace the existing Share button's `onClick={copyEventLink}` with the new dialog opener. No layout change.
- **`src/components/admin/EventControlRoom.tsx`** — same swap for the per-event Share button (line 486).
- **`src/components/EventCard.tsx`** — add a small Share icon button (using `Share2` from lucide) in the card's action row, visible only for **upcoming/active** events (filter: `end_date_time ?? date_time + 6h >= now` AND `status !== 'cancelled'`). Stops propagation so it doesn't trigger card navigation. Tap → opens the same dialog.

### 4. Verification

- In the live preview: click Share on an event card → dialog opens with a `https://zawya.app/events/<id>` link, Copy succeeds (toast), WhatsApp/Email buttons open the right targets.
- Open the copied link in a private window → lands on `/events/<id>`, unauthenticated users hit the login screen and are redirected back to the event after sign-in (existing behavior preserved).
- On mobile viewport: tapping Share invokes the native share sheet when available.
- Past/cancelled events do not show the Share button on cards.

### Out of scope

- No DB / RLS changes.
- No change to the deep-link route or the unauthenticated redirect flow.
- No OG/social preview metadata work (can be a follow-up if you want richer link unfurls in WhatsApp/iMessage).
