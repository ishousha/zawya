## Root cause

The recent security hardening migration converted `public.events` SELECT grants from a table-level grant to **column-level** grants that exclude `checkin_pin`, `zoom_password`, and `recording_passcode`.

In `src/components/HomeDashboard.tsx` (line 36), the "Upcoming Events" admin stat card queries:

```ts
supabase.from("events").select("*", { count: "exact", head: true })...
```

PostgREST expands `*` to **every** column of the table, including the three revoked ones, so the request returns `permission denied for table events`. The card falls back to its error state ("Couldn't load") shown in the screenshot.

The neighboring `profiles` count queries still work because nothing on `profiles` was revoked, and other `events` queries in the app already use explicit column lists (`EVENT_PUBLIC_COLUMNS` in `prefetch.ts` etc.). This is the only remaining `select("*")` on `events`.

## Fix

Single one-line edit in `src/components/HomeDashboard.tsx` — `head: true` count queries don't need real columns; any granted column works:

```ts
.select("id", { count: "exact", head: true })
```

No DB / migration / RLS changes. No other files affected.

## Verification

- After the edit, the admin home "Upcoming Events" card should show the actual count instead of "Couldn't load".
- Bump `public/version.json` so the PWA picks up the fix.
