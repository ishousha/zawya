## Goals

Make the Library scale to hundreds of resources by (a) richer linking when admins add a resource, (b) better filters & sort for both members and admins, and (c) parallel filters on the Recordings tab.

## 1. Schema — link resources to events, speakers, tags

Add to `public.resources`:
- `event_id uuid` nullable, FK to `events(id)` ON DELETE SET NULL — links a resource to the gathering it belongs to.
- `speaker_ids uuid[]` default `{}` — one or more speakers (supports multi-presenter sessions; cheaper than a join table for filter-only use).
- `tags text[]` default `{}` — free-form tags ("Ramadan", "Hajj", "Tafsir") for cross-cutting discovery.
- `resource_date date` nullable — explicit "session date" when the material isn't tied to a DB event (e.g. an old recording archived later). Falls back to `created_at` for sort/filter when null.
- Indexes: `idx_resources_event_id`, GIN index on `speaker_ids`, GIN index on `tags`, and `idx_resources_resource_date`.

Speakers are read by all authenticated users already, so no policy changes needed.

## 2. Admin — `ResourceManagement.tsx`

Add to the Add/Edit form (all optional, collapsed under a "Link to a gathering (optional)" section to keep simple uploads quick):
- **Linked Event** — searchable combobox listing past events (title + date), with a "None" option. When chosen, auto-fills suggested speakers from `event_speakers`.
- **Speakers** — multi-select combobox of `speakers` rows, with an inline "+ Add new speaker" action that opens a tiny dialog (name + optional bio) and inserts into `speakers`.
- **Tags** — free-form chip input (type + Enter to add, click × to remove). Suggestions from existing tags in the resources list.

Also rework the admin list view (the "Library" tab in admin):
- Add a sticky filter bar above the resource list: search input, category pills, **resource type** pills (PDF/Video/Audio/Link), **speaker** dropdown, **date range** dropdown (Any time / This month / This year / Custom), and sort (Newest / Oldest / A→Z / Most recently edited).
- Show event + speakers on each admin row so admins can spot what's linked at a glance.
- Bulk actions deferred — out of scope for now.

## 3. Member Library — `Library.tsx` (Resources tab)

Filter bar (collapses into a single "Filters" sheet on mobile to keep the page clean):
- Existing **category pills** stay (color-coded).
- **Resource type** pills (PDF / Video / Audio / Link).
- **Speaker** dropdown (single-select, searchable; "Any speaker" default).
- **Date** dropdown (Any time / This month / Last 3 months / This year / Older).
- **Sort** dropdown (Newest, Oldest, A→Z).
- Search input stays.
- Active filters render as removable chips above the result list, plus a "Clear all" link.

Card updates:
- When a resource has a linked event, show a small clickable pill "From: <Event title> · <date>" that links to the event detail page.
- When speakers exist, show their names below the description (`by Dr. X, Dr. Y`).
- Tags render as tiny muted chips at the bottom.

Empty / no-result state mentions which filters are active and offers a "Clear filters" button.

## 4. Member Library — Recordings tab

Add a filter row above the list:
- **Event type** pills (All / In-person / Online / Hybrid) — derived from existing `events.is_hybrid` and `events.online_link`/`virtual_link` fields.
- **Speaker** dropdown — uses `event_speakers` join.
- **Date range** dropdown (same presets as Resources).
- Search input over event title.
- Keep the existing newest-first sort plus a sort toggle (Newest / Oldest).

## 5. Out of scope (note for later)
- Pagination/infinite scroll — current 100-item cap stays; revisit when the library actually hits hundreds.
- Bulk admin actions (multi-select delete / re-categorize).
- Per-resource view counts and "popular this month" surfacing.

## Technical notes

- All new columns are nullable / default-empty, so existing rows keep working unchanged. No data backfill needed.
- The `speakers` dropdown reuses `useQuery(["speakers"])` (already cached by `SpeakerSelector` in event form code).
- Date filtering uses `resource_date ?? created_at` so legacy resources still appear in date buckets.
- Filters are URL-synced via `useSearchParams` so admins can share/return to a filtered view.
