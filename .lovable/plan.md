# Admin Event Finder Enhancements

Build on the existing `EventControlRoom.tsx` filter UI to give admins fast, precise control over event discovery.

## 1. Expanded search
- Search input filters across **title, event type name, location, address, and host name** (case-insensitive, debounced via existing `useDebounce`).
- Placeholder updates to "Search title, type, location, host…".

## 2. Sort toggle
- New `sortOrder` state: `"newest" | "oldest"`.
- Small toggle button next to the filter chips (icon + label, e.g. `↓ Newest` / `↑ Oldest`).
- Applies to **both** the upcoming and past sections (default view) and the combined filtered list.
  - Default remains: upcoming = soonest first (oldest), past = most recent first (newest). The toggle inverts both consistently.

## 3. Date-range filter (upcoming only)
- Two date pickers (shadcn Calendar in Popover) labeled "From" / "To", placed under the chip row inside a collapsible "Date range" section.
- Filters `upcomingAll` to events whose `date_time` falls within the inclusive range.
- Clear-range button; "Clear filters" also resets the range.
- Range is ignored for past events.

## 4. Jump-to-event picker
- A `Command` combobox (shadcn `Command` + `Popover`) above the chips, trigger button "Jump to event…".
- Lists all non-cancelled events (title + date), type-ahead by title.
- Selecting an event opens it directly in the edit form (`setEditing(event)`), the same flow as clicking Edit.

## 5. Saved filter sets
- New "Saved views" row of chips beside a `Save current` button.
- A saved set stores: `{ name, filters: FilterKey[], search, sortOrder, dateRange }`.
- Persistence: `localStorage` key `zawya.admin.eventFilters.v1` (per-browser; no schema change). Each admin keeps their own list.
- Actions: Save (prompts for a name), Apply (click chip), Delete (×  on chip).
- Empty state hint: "Save current view to reuse it later".

## 6. Testing
- Add a Vitest unit test for the filter/sort helpers (extract `applyFilters({events, filters, search, sort, dateRange})` into `src/lib/event-filters.ts`) covering:
  - search across title/type/location/host
  - sort newest vs oldest for upcoming & past
  - date-range inclusion bounds
  - status chip combinations
- Add a smoke test for the localStorage save/load of filter presets.
- Run `bunx vitest run` after implementation.

## Files

- `src/lib/event-filters.ts` — new, pure helpers (filter/sort/range, preset (de)serialize).
- `src/lib/event-filters.test.ts` — new, unit tests.
- `src/components/admin/EventControlRoom.tsx` — wire in sort toggle, expanded search match, date-range popover, jump-to combobox, saved-views chips; pipe events through new helper.
- `src/hooks/useSavedEventFilters.ts` — new, localStorage hook for presets.

## Out of scope
- Server-side persistence of saved views (kept local for now; can move to a `admin_event_views` table later if requested).
- Filtering by host, speaker, or type as separate chips (search already covers them).
- Changes to Cancelled section behavior.

## Technical notes
- Query still fetches up to 500 events; no schema/RLS changes.
- Host name already loaded via `host:host_id(name)`; event type name resolved via existing `useEventTypes()` map.
- Date pickers use `pointer-events-auto` on Calendar wrapper per shadcn datepicker guidance.
