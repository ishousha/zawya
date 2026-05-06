## Problem

Three views of the same potluck data are out of sync:

1. **Event card "Current Menu"** (member view) — uses the `get_event_potluck_menu` RPC, which unions both `rsvp_sign_up_selections` (claims against admin items) and legacy `rsvps.specific_food_item` text. Shows everything correctly.
2. **Admin → Event → Potluck Sign-ups tab** — shows `0` claimed for every item even though selections exist in the DB.
3. **Admin → Event → Guest List → "Potluck Menu (Host View)"** — only lists `rsvps.specific_food_item` (legacy free-text). Doesn't include items members claimed from the admin sign-up list.

I verified the data in the DB for the upcoming Thursday Gathering: 21 selection rows exist (e.g. Arabic Coffee × 2, Side Dish × 4, Dessert × 7, Karak × 3, Juice × 1, Other × 4) but the admin sign-up table shows 0 across the board.

## Root causes

**Bug A — Admin Potluck Sign-ups tab shows 0 claimed**
In `src/components/admin/EventRsvpDetail.tsx`, the `admin-signup-items` query:
- Reads `rsvpIds` from the outer `rsvps` state at execution time
- But its `queryKey` is `["admin-signup-items", eventId]` — does **not** depend on `rsvps`
- And it has `enabled: hasPotluck`, so it fires before the `rsvps` query resolves
- Result: `rsvpIds = []` → `selections: []` → all rows show 0, and it never refetches when RSVPs load

**Bug B — Host View potluck list is incomplete**
`src/components/HostDashboard.tsx` builds `potluckItems` only from `r.specific_food_item`. It ignores `rsvp_sign_up_selections`, so any member who claimed a structured item (e.g. "Arabic Coffee") never appears in the Host View list — even though they show up in the member-facing Current Menu.

## Fix

### 1. `src/components/admin/EventRsvpDetail.tsx`
- Make the `admin-signup-items` query depend on RSVPs:
  - Set `enabled: hasPotluck && !!rsvps`
  - Include rsvp ids (or just `rsvps?.length`) in the `queryKey` so it re-runs after RSVPs load
- No other logic changes; `potluckRows` already correctly aggregates `totalClaimed` and `claimants` once selections are present.

### 2. `src/components/HostDashboard.tsx`
- Fetch `rsvp_sign_up_selections` joined to `event_sign_up_items` for this event (alongside the existing rsvps query) so the Host View can list every claimed dish, not just legacy free-text.
- Build the Potluck Menu (Host View) list from both sources, mirroring the unioned shape used by the member-facing menu:
  - Structured claims → `"<item_name>" — <family/name>` (with optional description in parens)
  - Legacy `specific_food_item` → unchanged
- Keep the existing dependency map, sort by item order, and continue to show family/name attribution.

### 3. No DB or RPC changes needed
The `get_event_potluck_menu` RPC already returns the unioned view used by the event card, so the member-facing Current Menu stays as-is. After the fixes above, all three surfaces are driven by the same underlying data:

```text
event_sign_up_items  ──┐
                       ├── unioned view ─── Event card "Current Menu"   (RPC, unchanged)
rsvp_sign_up_selections┘                ─── Host View potluck list      (fix #2)
                                        ─── Admin Potluck Sign-ups tab  (fix #1)
rsvps.specific_food_item (legacy free text) participates in all three
```

### Verification
- Re-open the Thursday Gathering admin panel → Potluck Sign-ups should show non-zero "Claimed" counts and member names matching the DB (Arabic Coffee 2, Side Dish 4, Dessert 7, Karak 3, Juice 1, Other 4).
- Open Guest List → Potluck Menu (Host View) should now also list the structured claims (Arabic Coffee, Side Dish dishes, etc.), not only the "Surprise Dish" / "Cake" / "Biryani" free-text entries.
- Member-facing event card "Current Menu" remains unchanged.
