## Root cause

All four bugs are the same problem: **z-index stacking**.

- `EventFormTabs` modal is at `z-[60]`.
- `BottomNav` is also at `z-[60]` (`fixed bottom-0`) — same layer, but because BottomNav is mounted earlier/persistently it paints on top of the modal's bottom action bar. → **Publish/Save Draft buttons hidden behind the bottom tab bar**, so they appear "missing" and taps land on the nav instead.
- `EventPreviewDialog` (shadcn `Dialog`, default `z-50`) and the two `AlertDialog`s (`Unsaved changes`, `Remove items`) all render *below* the `z-[60]` modal. → **Eye icon opens the preview but it's invisible behind the form**, and clicking **X on a dirty form opens the confirm dialog behind the modal, leaving the user stuck (the "freeze")**.

Save Draft itself works in code; it's just unreachable because its row is occluded by BottomNav.

## Fix

1. **`src/components/admin/event-form/EventFormTabs.tsx`**
   - Bump modal overlay to `z-[80]` (outer `fixed inset-0`) and the inner card / sticky action bar correspondingly.
   - Pass an elevated `className` (e.g. `z-[100]`) to:
     - `EventPreviewDialog`'s `DialogContent`
     - both `AlertDialogContent`s
     - and their overlays (via the `Dialog`/`AlertDialog` overlay class) so they render above the modal.
   - Keep `BottomNav` untouched (still `z-[60]`).

2. **`src/components/admin/event-form/EventPreviewDialog.tsx`**
   - Accept/forward a `className` so the parent can lift it above the modal, or hard-code a higher z on `DialogContent` when used here.

3. Quick polish: when the modal is open on mobile, the action bar should clear the iOS safe area — already handled, just verify it's still above BottomNav after the z-index bump (it will be, since the modal is now `z-[80]` > BottomNav `z-[60]`).

## Verification

- Open Edit Event → Publish/Update and Save Draft buttons visible and tappable above BottomNav.
- Click eye icon → preview dialog appears on top.
- Edit a field, click X → "Unsaved changes" confirm dialog appears on top; Discard / Keep Editing both work.
- Remove a claimed item and Save → destructive confirm dialog appears on top.

No business-logic changes; pure presentation fix.
