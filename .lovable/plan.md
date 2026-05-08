## Bug analysis

**Bug 1 — sometimes lands on the events tab instead of the guest list:**
`AdminQuickActions` navigates to `/admin` with state, then `AdminDashboard` switches to the Events tab and dispatches an `admin-quick-action` window event after a fixed `80ms` setTimeout. `EventControlRoom` only registers its listener on mount. On the first navigation from another tab (Users / Scanner), the component mounts after the dispatch — the listener misses the event, so `monitoringEventId` is never set and the user sees the events list. Subsequent clicks work because the component is already mounted.

**Bug 2 — skips an event that is currently live:**
The `admin-next-event` query filters `.gte("date_time", now)`. A live event's `date_time` (start) is in the past, so it's excluded and the query returns the *following* event.

## Fix

### 1. `src/components/admin/EventControlRoom.tsx`
- Replace the `window` event listener pattern with reading navigation state directly from `react-router`'s `useLocation` inside `EventControlRoom`. On mount (and when location.state changes), if `state.tab === "events"` and `state.eventId` is set, call `setMonitoringEventId(state.eventId)`; if `state.action === "create"`, call `setCreating(true)`. This removes the mount-order race entirely.
- Keep `AdminDashboard`'s tab switch behavior, but stop dispatching the custom event (or keep dispatching as a no-op fallback — preferred: remove the dispatch + setTimeout).

### 2. `src/pages/AdminDashboard.tsx`
- Remove the `setTimeout` + `window.dispatchEvent` block. Just set the active tab. EventControlRoom will pick up `location.state` itself.
- Continue clearing `location.state` after handling so back/refresh doesn't retrigger — but only after EventControlRoom has consumed it. Simpler: don't clear it here; let EventControlRoom clear it via `navigate(pathname, { replace: true, state: null })` once it has applied the eventId.

### 3. `src/components/AdminQuickActions.tsx` — `admin-next-event` query
- Change the filter so a currently-live event is preferred:
  - Fetch events with status in `["active","full"]`, published, where **either** `end_date_time >= now` **or** (`end_date_time is null` AND `date_time >= now - 6 hours`) — i.e. include events that started recently and have no explicit end.
  - Order: pick the event whose effective end is closest in the future, with live events ranked first. Implementation: query both `date_time, end_date_time`, then in JS pick the event where `now` falls between start and effective-end (live), else the soonest upcoming.
  - Use a 6-hour fallback window for events missing `end_date_time` (matches typical gathering length; safe upper bound for "still live").

### Verification
- Hard reload `/admin` on Users tab → click Next Event Guest List → lands directly on the Event RSVP detail (guest list) on first click.
- Repeat from Scanner tab → same behavior.
- With an event currently live (start in past, end in future or within 6h window) → button opens that live event, not the next one.
- With no live event → opens the next upcoming event as before.
- With no upcoming or live event → existing "No upcoming events found" toast still shows.
