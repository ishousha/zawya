## Goal
Upgrade event short-links from random codes to admin-friendly "Smart Vanity URLs" (e.g. `/e/TG1405`) with auto-suggest, manual override, and server-side collision handling.

## 1. Database (single migration)

Replace the auto-generation trigger so it also handles **admin-supplied** short codes with collision fallback.

**New helper functions:**
- `normalize_event_short_code(_raw text) RETURNS text` — trims, replaces whitespace with `-`, strips non `[A-Za-z0-9_-]`, collapses repeated dashes, enforces length 3–32. Returns `NULL` if result is empty.
- `next_unique_short_code(_desired text, _self_id uuid) RETURNS text` — if `_desired` is free (excluding `_self_id`), returns it. Otherwise appends `-2`, `-3`, … until unique. Caps at `-99` then falls back to `gen_event_short_code()`.

**Replace `set_event_short_code()` trigger function** (BEFORE INSERT OR UPDATE):
```text
new_norm := normalize_event_short_code(NEW.short_code)
if TG_OP = 'UPDATE' and new_norm = OLD.short_code → keep as-is
if new_norm IS NULL → NEW.short_code := gen_event_short_code()
else                 → NEW.short_code := next_unique_short_code(new_norm, NEW.id)
```
Drop & recreate the trigger as `BEFORE INSERT OR UPDATE OF short_code`.

No RLS changes; admin policies already gate `events` writes.

## 2. Form state (`src/components/admin/event-form/types.ts`)

- Add `short_code: string` to `EventFormState` and `defaultEventForm` (`""`).
- Add helper `suggestShortCode(title: string, date_time: string): string`:
  - Take first two words of title, first letter each, uppercase. Strip non-alpha.
  - If only one usable word, take its first 2 letters uppercased.
  - Append `DDMM` from `date_time` (local timezone, padded).
  - Returns `""` if title or date missing.

## 3. EventFormTabs (`EventFormTabs.tsx`)

- Hydrate `short_code` from existing `event.short_code` when editing.
- Track `userEditedShortCodeRef = useRef(false)` — set true when user edits the input AND the value isn't equal to current suggestion.
  - When editing an existing event, default `userEditedShortCodeRef.current = true` (so we never overwrite the admin's saved code).
- `useEffect` on `[form.title, form.date_time]`:
  - If `!userEditedShortCodeRef.current`, set `form.short_code = suggestShortCode(...)`.
- Submit payload: include `short_code: form.short_code.trim() || null`. Server trigger will handle uniqueness + suffix.
- After successful insert/update, re-select `short_code` from the returned row and toast `Short link saved: zawya.app/e/<code>` so admins see the final value if a `-N` suffix was added.

## 4. Settings tab UI (`SettingsTab.tsx`)

Add a new field block (placed near the existing Check-in PIN row, since both are admin operational fields):

```text
Custom Short Link (Optional)
[ TG1405               ] .copy
zawya.app/e/<value>
We'll auto-suggest from title + date. Edit freely; if it's taken, we'll append -2.
```

- Input: `value={form.short_code}`, on change → set form + mark `userEditedShortCodeRef.current = true` (passed down via callback prop, e.g. `onShortCodeUserEdit`).
- Inline helper text shows live preview URL using `getEventShareUrl`.
- Lightweight client validation (zod) on blur: `^[A-Za-z0-9_-]{3,32}$`. Show error message but don't block submit (server normalizes/falls back).
- Small "↺ Re-suggest" button that resets the manual flag and regenerates from title+date.

## 5. Routing (`/e/:shortCode`)

Already implemented in `src/pages/EventShortLinkRedirect.tsx` — it queries `events.short_code` and redirects, with toast on miss. **No code change needed**, but we'll widen the allowlist regex in `AppRoutes.tsx` `isSafeRedirectPath` from `[A-Za-z0-9]{4,12}` to `[A-Za-z0-9_-]{3,32}` to cover dashes, underscores, and the `-N` suffix.

## 6. QA

1. Type "Thursday Gathering", set date May 14 → field auto-fills `TG1405`. Edit to `Suhba` → suggestion stops overwriting.
2. Save with `TG1405` already taken → server returns `TG1405-2`, toast shows the final URL.
3. Edit existing event without touching short_code → unchanged.
4. Submit empty short_code → server falls back to random 6-char code (existing behavior).
5. `/e/TG1405-2` resolves to event detail; `/e/notreal` shows toast and redirects home.

## Out of scope
- Reserved-word blocklist (e.g. `admin`, `api`).
- Live "is this taken?" check while typing (we let the server resolve at save).
- Bulk renaming of legacy random codes.
