## Plan

1. **Fix the onboarding family creation path**
   - Update `Onboarding.tsx` so “Create a Family Group”, “Continue as Individual”, and “Skip for now” use the existing secure backend function `create_my_family` instead of directly inserting into `families`.
   - This matches the profile page’s working `FamilyInviteSection` behavior and avoids the row-level security error users are seeing.

2. **Keep profile linking safe**
   - Let the backend function create the family and link the current user’s profile in one trusted operation.
   - Keep the existing behavior for users who already have a `family_id`: they can still update their family name.

3. **Make errors user-friendly**
   - Replace raw database-policy messages like `new row violates row-level security policy` with a simple message such as “We couldn’t create your family group. Please try again.”
   - Preserve the existing “already in a family group” handling.

4. **Verify the fix**
   - Confirm the family RLS policy no longer blocks onboarding because direct client inserts are removed.
   - Check the relevant onboarding flow logic for both “family group” and “individual” paths.

## Technical details

- The current bug is caused by `Onboarding.tsx` doing:
  - direct `families.insert(...)`
  - then `profiles.update(...)`
- The `families` table currently allows viewing/updating/deleting a user’s own family, but does **not** allow normal users to directly create a `families` row.
- A secure `create_my_family(p_name)` backend function already exists and is executable; it inserts the family and links `profiles.family_id` server-side.
- No database schema change should be needed unless verification finds the function itself misconfigured.