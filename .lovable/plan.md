# Profile "Update App" button + version status

## Goal
Replace the existing "Force Refresh App" button on the Profile page with a smarter "Check for updates" button, plus an inline status line so users can see whether their installed build is current.

## What users will see
On the Profile page, in place of today's "Force Refresh App" button:

```text
You're up to date · Build May 14, 22:31           [ ✓ ]
[ Check for updates ]
```

When a newer build exists:

```text
Update available · New build May 18, 10:02        [ • ]
[ Update App ]
```

While checking:

```text
Checking for updates…
[ Checking… ]   (disabled)
```

The standalone `Build {timestamp}` line at the bottom of Profile is removed (folded into the status above).

## How it works

1. On build, Vite writes a tiny `public/version.json` containing `{ "buildTime": "<ISO>" }`. This file is served fresh (no SW cache — already in proxy no-store rules).
2. Profile mounts → fetches `/version.json?ts=<now>` (cache: no-store) and compares `serverBuildTime` vs the bundled `__APP_BUILD_TIME__`.
3. Status states: `up-to-date`, `update-available`, `checking`, `unknown` (fetch failed → show neutral "Check for updates").
4. Button behavior:
   - `update-available` → label "Update App". On tap: toast "Updating to latest version…" then run existing `forceRefreshApp()`.
   - `up-to-date` → label "Check for updates". On tap: re-fetch `version.json`. If still current → toast "You're on the latest version ✓" (no reload). If newer appeared → flip to update-available state.
   - `unknown` → label "Check for updates". On tap: same re-check; if still failing → toast "Couldn't check — refreshing anyway" and run `forceRefreshApp()` as fallback.
5. Auto re-check on tab focus (cheap, mirrors what `PWAUpdatePrompt` already does for the SW path).

## Files to touch
- `vite.config.ts` — add a tiny plugin (or `writeBundle` hook) that emits `dist/version.json` with the same `buildStamp` already used for `__APP_BUILD_TIME__`. Also emit for dev so the fetch doesn't 404 locally (write `public/version.json` at config load).
- `src/hooks/useAppVersion.ts` — new hook: returns `{ status, serverBuildTime, localBuildTime, recheck }`.
- `src/pages/Profile.tsx` — replace the existing Force Refresh button block with the new status row + contextual button. Remove the standalone "Build …" footer line (now shown in status).
- No DB, no edge functions, no other components.

## Technical notes
- `__APP_BUILD_TIME__` is already defined in `vite.config.ts` and typed in `src/vite-env.d.ts`. Reuse it as the "local" timestamp.
- Comparison uses `Date.parse(serverBuildTime) > Date.parse(localBuildTime) + 1000` (1s skew tolerance).
- Fetch with `{ cache: "no-store" }` and a `?ts=` cache-buster to defeat any intermediate caching.
- Keep `forceRefreshApp()` as-is — the new button just decides *when* to call it.
- `PWAUpdatePrompt` continues to handle the service-worker-driven toast independently; the two paths don't conflict (both end up calling reload/forceRefresh).

## Validation
- Fresh build deployed → open Profile → status shows "You're up to date". Tap button → toast "You're on the latest version ✓", no reload.
- Deploy a newer build, keep old tab open → on focus or button tap, status flips to "Update available", button label becomes "Update App", tap reloads to new build.
- Offline / version.json fetch fails → status hidden or "Couldn't check", button still works as fallback refresh.
