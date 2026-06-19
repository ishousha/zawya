# Default host on venues

## Backend

Migration adds one nullable column and extends the existing audit trigger:

```sql
ALTER TABLE public.venues
  ADD COLUMN default_host_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS venues_default_host_id_idx
  ON public.venues(default_host_id);
```

`log_venue_changes` is updated so its `_fields` array includes `default_host_id`, keeping the activity log honest.

No RLS changes — `venues` is already readable/writeable per existing policies.

## VenueManagement.tsx (Admin → Settings → Venues)

- Extend the `Venue` interface with `default_host_id: string | null` (and the joined `default_host` display fields fetched via a left join: `*, default_host:profiles!venues_default_host_id_fkey(id,name,email)`).
- Add a "Default Host" column to the table.
- Inside the Add/Edit dialog, add a "Default Host (optional)" field that reuses the existing `HostSelector` component (already a member search with clear button). The selected id is persisted on save.
- Form state gains `formDefaultHostId`, reset in `openAdd` / `openEdit` / `closeDialog`. Save payload sends `default_host_id: formDefaultHostId || null`.

## VenueSelector.tsx (event form)

- Add `default_host_id` to the local `Venue` type and select it (`select("*")` already covers it; just type it).
- Change the `onChange` signature to include the venue's default host id:
  ```ts
  onChange: (
    venueId: string | null,
    name: string,
    address: string,
    areaHint: string,
    mapsUrl: string,
    defaultHostId: string | null,
  ) => void;
  ```
- Pass `venue.default_host_id ?? null` from every call (list pick, freshly saved venue, clear/delete → `null`).

## DesignTab.tsx wiring

When the user picks a venue, set the host automatically:

```ts
setForm((prev) => ({
  ...prev,
  venue_id: venueId,
  location: name,
  address,
  maps_url: mapsUrl ?? "",
  location_hint: areaHint || prev.location_hint,
  host_id: defaultHostId ?? prev.host_id,
}));
```

Rule: if the venue has a default host, it overwrites the form's host. If the venue has no default host, the existing host (if any) stays. Clearing the venue does not clear the host (avoids surprise resets).

The host field still lives in the Settings tab via `HostSelector`, so admins can override the auto-filled host after selection.

## Files

- New migration (column + trigger refresh).
- `src/components/admin/VenueManagement.tsx` — table column + dialog field.
- `src/components/admin/event-form/VenueSelector.tsx` — type + onChange signature + call sites.
- `src/components/admin/event-form/DesignTab.tsx` — apply `defaultHostId` to form.

## Out of scope

- Backfilling default hosts on existing venues.
- A per-event-type host fallback.
- Showing the default host inside the event preview (it'll just appear in the Settings tab once selected).
