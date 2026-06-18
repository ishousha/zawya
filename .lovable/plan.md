# Easier event finding in Admin → Events

Reorganize the admin event list so upcoming events are front and center, past events stay out of the way, and admins can stack filters + search.

## Behavior

**Default view (no filters, no search):**
- **Upcoming Events** section at top — chronological (soonest first).
- **Past Events** section below, collapsed by default, with count badge. When expanded, ordered most-recent-first (reverse chronological).
- Cancelled events keep their existing collapsed section at the bottom.

**Filter chips become multi-select.** Each chip toggles independently and chips combine with AND for time-bucket / OR within the status group:
- Time: `Upcoming` (default on), `Past`
- Status: `Published`, `Scheduled`, `Draft`
- Selecting any chip switches off the auto-split layout and renders a single filtered list (no collapsed Past section), still ordered by date_time (asc for upcoming-only, desc when Past is included).
- An `All` / `Clear filters` reset button restores the default split view.

**Search input** above the chips: filters by event title (case-insensitive, debounced). Works alongside chips.

**Counts** stay on each chip and reflect what's currently selectable (independent of search).

## Files

- `src/components/admin/EventControlRoom.tsx`
  - Replace single `statusFilter` state with `Set<Filter>` plus a `search` string.
  - Compute `upcomingEvents` / `pastEvents` from the existing query (already orders by date_time asc). Sort `past` descending for display.
  - Replace the single-select chip row with multi-select chips + clear button + a search `<Input>` with a leading `Search` icon.
  - Render either the split layout (default) or the combined filtered list (when any filter/search active).
  - Add a `<Collapsible>` wrapper for the Past Events section, default closed.

## Data

- Bump the events query `.limit(50)` to `.limit(500)` so past events are reachable when expanded. No schema or RLS changes.

## Out of scope

- Server-side pagination / infinite scroll for past events.
- Date-range pickers, host/type filters (can be added later if needed).
- Cancelled events section (unchanged).
