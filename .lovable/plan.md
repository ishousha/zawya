# Fix: Check-in tab event list

## Problem
On Admin → Check-in:
1. The event dropdown lists **all** active/full events including past ones (Apr 16, Apr 17, etc. while today is May 8).
2. Only a currently *live* event gets a highlighted card above the dropdown — if nothing is live right now, the next upcoming event is buried inside a long list of stale past events.

Check-in is only meaningful for an event that is happening today/now or about to start, so past events should not be selectable.

## Changes (scoped to `src/components/admin/AdminDoorScanner.tsx` only)

1. **Filter the events query** to exclude past events.
   - In the `admin-events-active` query, only return events whose effective end (`end_date_time`, or `date_time + 6h` fallback) is `>= now`.
   - Easiest: keep the existing query but filter client-side right after fetch, so the same logic that powers `liveEvent` stays consistent. (Server-side `.gte('date_time', ...)` would miss long events that started earlier today but haven't ended.)

2. **Surface the next upcoming event separately** when no event is live.
   - Compute `nextUpcomingEvent` = earliest event with `date_time > now` (excluding the live one).
   - If `liveEvent` exists → render the existing "LIVE NOW" card (unchanged).
   - Else if `nextUpcomingEvent` exists → render a sibling card with the same layout but labelled "UP NEXT" (calendar icon, no pulsing dot, shows relative start like "Starts Thu, May 14 · 7:00 PM").
   - Auto-select behavior: if nothing is live, auto-select the next upcoming event on first mount (mirrors the current `liveEvent` auto-select).

3. **Dropdown contents** then naturally only contain present + future events. Sorting stays: live first, then chronological. The featured event (live or up-next) still appears in the dropdown so the admin can re-pick it after switching away.

4. **Empty state**: if there are zero current/future events, show a small muted message in place of the dropdown ("No current or upcoming events to check in.") and hide the scanner controls.

## Out of scope
- No DB or RLS changes.
- No changes to other admin tabs, EventControlRoom, or the events feed.
- No change to how a "live" event is defined.

## Verification
- Open Admin → Check-in: dropdown shows only events from today onward; Apr events disappear.
- When no event is live, an "Up Next" card appears above the dropdown with the soonest future event pre-selected.
- When an event is live (start ≤ now ≤ effective end), the existing "Live Now" card renders instead, unchanged.
- With no current/future events, a friendly empty state renders and no scanner UI appears.
