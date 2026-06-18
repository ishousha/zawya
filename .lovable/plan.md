# Extract coordinates from Google Maps URL on event save

Add lat/lng + check-in radius columns to `events`, and parse them client-side from `maps_url` before insert/update. No UI changes, no other field behavior changes.

## 1. Database migration

Add to `public.events`:
- `latitude numeric` (nullable)
- `longitude numeric` (nullable)
- `checkin_radius_meters integer NOT NULL DEFAULT 100`

No RLS changes (table policies already cover these columns). After migration runs, the regenerated `types.ts` exposes the new fields.

## 2. URL parser

New `src/lib/maps-url.ts`:
- `parseGoogleMapsCoords(url: string): { lat: number; lng: number } | null`
- Tries, in order:
  1. `/@<lat>,<lng>` (standard Maps link)
  2. `!3d<lat>!4d<lng>` (embed/place format)
  3. `?q=<lat>,<lng>` / `&q=<lat>,<lng>` / `&query=<lat>,<lng>` / `&ll=<lat>,<lng>` / `&destination=<lat>,<lng>`
- Validates `-90 ≤ lat ≤ 90`, `-180 ≤ lng ≤ 180`. Returns `null` on any failure (never throws).
- Short links (`goo.gl/maps`, `maps.app.goo.gl`): no client-side resolution (CORS blocks it). Return `null` and let the admin paste the expanded URL — extraction is best-effort per the requirement ("if extraction fails, store null and continue").
- Small Vitest unit test (`maps-url.test.ts`) covering each pattern, invalid bounds, empty input, short-link null.

## 3. Wire into save

In `src/components/admin/event-form/EventFormTabs.tsx` where the payload is built (~line 289):
- Compute `const coords = form.maps_url ? parseGoogleMapsCoords(form.maps_url) : null;`
- Add to payload: `latitude: coords?.lat ?? null`, `longitude: coords?.lng ?? null`.
- Leave `checkin_radius_meters` alone on save (uses DB default; not in the form).
- Wrap the parse in try/catch so a malformed URL never blocks save.

## Files
- `supabase/migrations/<timestamp>_event_coords.sql` — adds the 3 columns.
- `src/lib/maps-url.ts` — new parser.
- `src/lib/maps-url.test.ts` — new unit tests.
- `src/components/admin/event-form/EventFormTabs.tsx` — add coords to payload.

## Out of scope
- UI to display, edit, or visualize lat/lng or radius.
- Backfilling coords for existing events.
- Server-side short-link expansion (would need an edge function; not requested).
- Using the coordinates for geofenced check-in (column is added per request; consumers come later).

## Verify
- Run `bunx vitest run src/lib/maps-url.test.ts`.
- Check preview health after migration + edits.
