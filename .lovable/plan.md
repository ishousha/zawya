# Fix Edit RSVP bugs (self double-counted, broken Status dropdown, unclear remove)

## Bug 1 — Member shown as their own "Family" dependent (party of 2 instead of 1)

**Root cause:** When a member RSVPs for just themselves, `RSVPModal` writes an `attending_dependents` entry of `{ type: "family_member", id: <self.id>, name: <self.name> }`. The RSVP also has `guests_count = 1`. The list view shows `1` (correct, from `guests_count`), but `EditRsvpDialog` derives:

```
adults = max(1, guests_count − attending_dependents.length) = max(1, 1 − 1) = 1
deps   = attending_dependents                              = [self]
total  = adults + deps.length = 2
```

So Mai appears once as the "adult" member and again as a Family dependent.

**Fix (presentation-only, in `src/components/admin/EditRsvpDialog.tsx`):**
- When seeding `deps` from `rsvp.attending_dependents`, filter out any `family_member` entry whose `id === rsvp.user_id` (the member themselves). Keep all other family members, dependents, and guests as-is.
- Recompute `adults` against the filtered list so the math stays consistent (`adults = max(1, guests_count − filteredDeps.length)`).
- The save path already rebuilds `cleanedDeps` from local state, so saving will also drop the spurious self entry and bring stored data back in line.

No DB migration, no change to `RSVPModal` (separate cleanup if you want to stop writing the self entry going forward — out of scope for this fix).

## Bug 2 — Status dropdown doesn't open on mobile

**Likely cause:** Radix `Select` inside the Radix `Dialog` on iOS can lose pointer events when the dialog content is the touch target ancestor; the trigger gets focus (green ring in screenshot) but the content portal never opens. This is a known interaction issue and the standard remedy is to render the Select content with explicit `position="popper"`, `sideOffset`, and a high `z-index`, and to avoid the dialog's pointer-events lock by passing `onOpenAutoFocus`/`modal` tweaks.

**Fix (in `EditRsvpDialog.tsx` only):**
- Add `position="popper"`, `sideOffset={4}`, and `className="z-[60]"` to the Status `<SelectContent>` (and to the dependent age-group `SelectContent` for consistency).
- If the trigger still won't open after the popper change, fall back to `<Dialog modal={false}>` for this dialog — the dialog already has its own overlay/close affordances, so non-modal is acceptable here.

I'll verify with Playwright at mobile viewport (420×749) after the change: open Edit RSVP, tap Status, confirm the options panel renders and selection updates state.

## Bug 3 — How does an admin "kick out" an attendee?

Two existing affordances already cover this — they just aren't obvious:
1. The red **trash icon** in the RSVP row deletes the RSVP entirely (with an undo toast). That is the "remove from event" action.
2. Inside Edit RSVP, the Status dropdown has **Cancelled** (becomes selectable once Bug 2 is fixed), which keeps the row for audit but frees the seat.

**Fix (small UX clarification, no logic change):**
- Tooltip/`title` on the trash icon: "Remove RSVP" (currently has no label).
- In Edit RSVP, add a one-line helper under Status: "Set to *Cancelled* to free the seat without deleting the record, or use the trash icon in the list to remove it entirely."

## Files touched

- `src/components/admin/EditRsvpDialog.tsx` — filter self from incoming deps, popper props on `SelectContent`, helper text under Status.
- `src/components/admin/EventRsvpDetail.tsx` — `title="Remove RSVP"` on the trash button.

## Verification

- Open Mai's Edit RSVP → Adults `1`, Dependents `0`, Total party size `1`, Capacity unchanged.
- Tap Status on mobile (420×749) → dropdown opens, "Cancelled" selectable, Save applies.
- Trash icon tooltip reads "Remove RSVP".

## Out of scope

- Backfilling existing RSVP rows that contain a self `family_member` entry (the edit-and-save flow self-heals when an admin or the member next saves).
- Changing `RSVPModal` to stop writing the self entry on new RSVPs (separate cleanup — say the word and I'll add it).
