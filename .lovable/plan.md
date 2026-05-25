## Goal
Stop users from claiming sign-up items that have hit their `quantity_limit`. Frontend-only — no DB changes, existing overbooked rows stay intact.

## Scope
Single file: `src/components/RSVPModal.tsx`. The two rendering blocks (potluck list ~L502 and non-potluck sign-up list ~L641) and the submit handler (~L224).

## Changes

### 1. Replace `isItemAtTarget` with a hard "isFull" check
- Today `isItemAtTarget` returns true at `claimed >= quantity_limit` but the UI only shows a soft "(Target Reached)" label — checkbox still works.
- Add a helper:
  - `getRemaining(item)` → `quantity_limit === 0 ? Infinity : max(0, quantity_limit - claimed)` (handles the 9/8 overbook case by clamping at 0).
  - `isItemFull(item)` → `getRemaining(item) <= 0 && quantity_limit > 0`.
- Keep `claimedPerItem` math as-is (it already excludes the user's own existing selections, so editing your own RSVP won't lock you out of your existing item).

### 2. Hard-lock the UI in both list blocks (potluck + non-potluck)
For each item where `isItemFull(item) && !isSelected`:
- Render the `<label>` as a non-interactive `<div>` (no `cursor-pointer`, add `opacity-60 pointer-events-none` plus muted background).
- Render `<Checkbox disabled checked={false}>`.
- Replace the "(Target Reached)" hint with a **"Full"** badge (small pill, muted/destructive styling, lock icon from `lucide-react`).
- Quantity line shows `{quantity_limit}/{quantity_limit} claimed — full` (never display negatives; clamp display claimed at `quantity_limit`).
- Drop the "extra contributions are always welcome" italic line for full items.

If `isSelected` (user already had it selected in this session or from their existing RSVP), keep it interactive so they can uncheck — never trap a selection.

### 3. Pre-submission validation in `handleSubmit`
Before calling `createRSVP` / `updateRSVP`:
1. Refetch the latest claims via `queryClient.invalidateQueries({ queryKey: ["signup-claims", event.id] })` then `await refetch` of `useEventSignUpClaims` (expose `refetch` from the hook call, or read fresh data through `queryClient.fetchQuery`).
2. Recompute `claimedPerItem` from the fresh data (still subtracting the user's *previously persisted* selections from `mySelections`, not the in-flight ones).
3. For each currently-selected item (excluding `OTHER_ITEM_ID` and items already in `mySelections`), check if it is now full.
4. If any newly-selected item is full:
   - Uncheck those item ids in `selections` state.
   - `toast.error("Sorry, one of your selected items just filled up. Please choose another.")` (include item names in the description).
   - Return early — do not submit.

### 4. Small polish
- Import `Lock` from `lucide-react` for the lock icon.
- No copy changes elsewhere; no changes to `useRSVP.ts`, the admin views, or any SQL.

## Out of scope
- No backend constraints, no migrations, no edits to overbooked rows.
- Waitlist/capacity logic untouched.
- Admin event edit / reclaim flows untouched.

## Test checklist
- Open RSVP on an event with a full item → checkbox disabled, "Full" badge, can't select.
- Overbooked item (9/8) → renders as full, no negatives, no crash.
- Editing your own RSVP that includes a full item → you can still uncheck it; if you uncheck and try to re-check, it locks.
- Two tabs: select last spot in tab A, submit; in tab B (still showing it available) click submit → toast appears, item auto-unchecks, no DB write.
- Items with `quantity_limit = 0` (no limit) continue to behave as before.
