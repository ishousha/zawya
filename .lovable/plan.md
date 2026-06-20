## Change

In `src/pages/Library.tsx`, update the "Past Gatherings" tab to only show events with a recording, and rename the tab.

### Edits

1. **Tab label**: Rename `Past Gatherings` → `Recordings` (both the `TabsTrigger` and the empty state copy/icon).

2. **Query `past-events`**:
   - Add `.not("recording_url", "is", null)` and `.neq("recording_url", "")` to the Supabase query so only events with a recording added are returned.
   - Keep the existing past-time filter (end_date_time < now, or date_time < cutoff when end is null) so it stays scoped to past events.
   - Query key bumped to `["past-events-with-recordings"]` to avoid stale cache from the old query.

3. **Empty state**: Update message to "No recordings available yet." with a sensible icon (e.g. `Video`).

No DB, RLS, or other component changes — `recording_url` is already in `EVENT_PUBLIC_COLUMNS` and readable by members.