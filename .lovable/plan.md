# Enrich Admin Activity Log Filters

Add a complete set of filters on top of the existing date range + single-action filter in the Activity Log tab. All changes are UI-only in `src/components/admin/AdminActivityLog.tsx` — no schema or trigger changes needed (the triggers already store `actor_id`, `target_user_id`/`target_user_name` (which holds the event id/title for event-scoped actions), `action`, and `details`).

## New filters

1. **Category** (Users / Events / Content / Guests / Check-ins) — quick group filter that narrows the action dropdown to that group. Selecting a category shows only its actions; the existing per-action select stays as a finer second filter.
2. **Action** — keep current grouped dropdown, but auto-filtered by the selected category.
3. **Event** — dropdown listing every distinct event title found in logs (built from entries whose action group is Events or Guests, using `target_user_name` as the title and `target_user_id` as the stable key). Picking one filters all logs touching that event.
4. **Admin (actor)** — dropdown of every distinct actor that appears in the current log set, showing name (fallback email). Built from `actorMap`.
5. **Target user** — dropdown of distinct member targets for Users-group actions (role change, suspend, delete, create), keyed by `target_user_id`.
6. **Search** — free-text input that matches against action label, actor name/email, target name/email, and serialized `details` (case-insensitive).
7. **Date From / To** — keep existing calendar pickers.

## UI layout

- Top row: title + result count + Refresh + Export (unchanged).
- Second row: Search input (flex-grow) + Category select + Action select + Event select + Admin select + Target select + From + To.
- Third row (only when any filter is active): chips showing the active filters with an "×" each, plus a single **Clear all** button.

Filters compose with AND. Empty/`all` values are ignored. The result count and CSV export both use the filtered list.

## Implementation notes (technical)

- All filter state lives in `useState` in the component; no URL sync.
- Derive option lists with `useMemo` from `logs` + `actorMap` so they update when data refreshes.
- For the Event filter, dedupe by `target_user_id` for rows where `ACTION_CONFIG[action]?.group` is `"Events"` or `"Guests"`, displaying `target_user_name` (fallback to id slice).
- For Target user filter, dedupe by `target_user_id` for rows where group is `"Users"`.
- When Category changes, reset Action to `all` if the previous action does not belong to that group.
- Search is a simple lowercase `includes` over a string built per row.
- No changes to queries, hooks, triggers, RLS, or types.

## Out of scope

- Server-side pagination / search (still client-side over the latest 500 rows).
- Saving filter presets.
- Filtering by IP / session.
