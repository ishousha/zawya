## 1. Progressive Unlock for the "Other / Surprise Dish"

**File:** `src/components/RSVPModal.tsx`

The wildcard is a frontend-only virtual item rendered with `OTHER_ITEM_ID = -1` (no DB row). Today it's always selectable. We'll gate it behind essential-item fill.

- Compute `essentialsFull` inside the modal:
  - Iterate `signUpItems` excluding any item where `quantity_limit === 0` (those are "unlimited" and cannot be "filled", so they're excluded from the check — otherwise the wildcard would never unlock).
  - For each, sum `quantity_limit` into `totalEssentialCapacity` and `min(claimed + (isSelectedByMe ? 1 : 0), quantity_limit)` into `totalEssentialClaimed` so the user's own pending picks count toward the unlock in real time.
  - `essentialsFull = totalEssentialCapacity > 0 && totalEssentialClaimed >= totalEssentialCapacity`.
  - Edge case: if there are zero limited items (only "no limit" items or no items at all), treat as `essentialsFull = true` so we don't permanently lock the wildcard on events without quotas.
- Apply to the "Other / Surprise Dish" block (~L631-660):
  - `const otherLocked = !essentialsFull && !(selections[OTHER_ITEM_ID]?.selected)` — never trap an existing selection.
  - When locked: render the row with `opacity-60 cursor-not-allowed`, disable the `Checkbox`, swap the helper copy for a small badge `🔒 Unlocks once essential items are covered` using the existing `Lock` icon and the same muted pill styling already used for "Full".
  - Hide the description input while locked.

No DB / schema / RLS changes. No edits to `useRSVP.ts`.

## 2. Door Verification — Promised Items in Check-in

**File:** `src/components/admin/AdminDoorScanner.tsx`

Today the attendees query only fetches `id, checked_in, guests_count, user_id` + names. We'll extend it to fetch each RSVP's promised sign-up selections and render them prominently.

- Extend the `door-scanner-attendees` query:
  - After loading rsvps + profiles, run a single `supabase.from("rsvp_sign_up_selections").select("rsvp_id, quantity, description, sign_up_item_id, event_sign_up_items(item_name)").in("rsvp_id", rsvpIds)`.
    - If the implicit FK join isn't available, fall back to two queries: selections then `event_sign_up_items` filtered by the collected ids, joined in JS.
  - Build a `promisedByRsvp: Map<rsvp_id, { name: string; quantity: number; description: string | null }[]>`.
  - Add `promised` to each `AttendeeRow`.
- Extend `AttendeeRow` type with `promised: { name; quantity; description }[]`.
- **Manual list row (~L437-486):** below the name, render a prominent "Promised" alert box (amber/gold accent, e.g. `border-accent bg-accent/10`, bold text) listing each item as `{quantity}× {name}{description ? ` — ${description}` : ""}`. If none promised, show a muted `No potluck item promised`. Use existing semantic tokens (`text-foreground`, `border-accent`) — no raw colors.
- **QR scan-success result (~mutation `checkIn.onSuccess` and the `lastResult` Card):**
  - Inside `checkIn.mutationFn`, after we find the rsvp, fetch its selections the same way and attach `promised` to the success payload.
  - Extend `lastResult` shape to optionally include `promised` items + attendee name; the success Card (~L568-580) renders an additional prominent block: `Promised: 2× Samosas, 1× Drinks` styled like an alert so the volunteer is forced to read it before tapping "Scan Next Ticket".
- No changes to scan flow, RLS, or check-in mutation logic itself — admins already have `SELECT` on `rsvp_sign_up_selections` and `event_sign_up_items` via existing policies.

## What we explicitly do NOT touch

- No SQL migrations, no schema/column/RLS changes.
- No edits to `useRSVP.ts`, capacity/waitlist logic, or email functions.
- Wildcard remains purely a frontend virtual item; existing RSVPs with `OTHER_ITEM_ID` selections continue to behave identically (description is appended to `specific_food_item`).

## Files to edit

- `src/components/RSVPModal.tsx`
- `src/components/admin/AdminDoorScanner.tsx`
- `public/version.json` (bump build time)
