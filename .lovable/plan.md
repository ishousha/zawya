## Scope
Change the "Jump to event" picker in the admin Event Control Room so events appear with the most recent date first (descending) instead of oldest first (ascending).

## Change
In `src/components/admin/EventControlRoom.tsx`, line ~393-396:

```ts
const jumpEvents = useMemo(
  () => sortEvents(nonCancelled as any, "oldest"),
  [nonCancelled],
);
```

Replace `"oldest"` with `"newest"` so the dropdown lists events from newest to older.

## Verification
- Open the admin Events tab.
- Click "Jump to event…" dropdown.
- Confirm the list starts with the nearest/upcoming or most recent event and goes backward in time.

No other behavior affected.