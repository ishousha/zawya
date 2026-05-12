## Plan

1. Remove the duplicate **“Potluck Menu (Host View)”** section from `HostDashboard`.
   - Keep the host dashboard headcount summary.
   - Keep the guest list when `hideGuestList` is false.
   - Stop showing the broken/duplicated potluck list that currently displays `Unknown`.

2. Keep the real potluck management view in the admin event detail modal.
   - The **Potluck Sign-ups** tab already has the useful admin controls: item, needed, claimed, claimed by, reassign, remove, and assign.
   - This avoids two separate potluck views with different data logic.

3. Clean up unused potluck-only code/imports in `HostDashboard`.
   - Remove the `UtensilsCrossed` import.
   - Remove the sign-up item query and potluck list mapping from that component.

## Result

Admins/hosts will no longer see the confusing host potluck list with `Unknown`; they’ll use the dedicated **Potluck Sign-ups** tab for names and assignments.