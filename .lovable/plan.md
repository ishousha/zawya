# Fix: Family/Member dropdowns hidden behind dialog

## Problem
On Admin → Families → "Assign Member to Family", the Family and Member combobox dropdowns render behind the dialog (and behind the on-screen keyboard accessory bar), making selections nearly invisible and hard to use.

## Root cause
`DialogContent` and `DialogOverlay` use `z-[100]`, but `PopoverContent` uses the default `z-50`. The popover portal is layered under the dialog, so the list appears dim/behind.

## Fix
In `src/components/admin/FamilyManagement.tsx`, raise the z-index on the two `PopoverContent` elements inside the "Assign Member to Family" dialog (Family selector + Member selector) to sit above the dialog layer.

- Add `z-[110]` (and a solid background to ensure full opacity) to both `PopoverContent` className props.
- Keep widths and alignment unchanged.

No other files, no logic changes, no DB changes.

## Validation
- Open Admin → Families → Assign Member to Family.
- Family dropdown appears fully opaque, above the dialog.
- Member dropdown same.
- Selecting a family/member still works and closes the popover.
