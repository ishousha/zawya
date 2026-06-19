## Problem

On `CompleteProfile`, members see one "Full Name" field and an optional "Family Name" field. Many type only their first name into "Name" and their surname into "Family Name". The admin user cards render `profile.name` as the headline, so they show just the first name with the surname relegated to a small line — losing the full name.

## Fix

Restructure the onboarding form to capture **First Name** and **Last Name** as two required fields, then store the combined value in `profiles.name` (and the surname in `profiles.family_name` for filtering/search).

### Changes in `src/pages/CompleteProfile.tsx`

1. Replace the single "Full Name" input with two side-by-side inputs:
   - **First Name** (required)
   - **Last Name** (required)
2. Remove the separate optional "Family Name" field (it duplicates Last Name and is the source of the confusion).
3. Pre-fill from OAuth metadata:
   - First name: `meta.given_name || meta.first_name || first token of meta.name/full_name/display_name`
   - Last name: `meta.family_name || meta.last_name || remaining tokens of meta.name/full_name/display_name`
   - If an existing `profile.name` is already set, split it on the first space to seed the two inputs.
4. On submit:
   - Validate both names are non-empty (trimmed).
   - Save `name = "First Last"` and `family_name = "Last"` to `profiles`.
   - Keep all other behavior (gender, WhatsApp, admin notification email) unchanged.
5. Update the admin notification `memberName` payload to use the new combined full name.

### No database migration

`profiles.name` and `profiles.family_name` already exist and are used correctly across the app (admin cards, host selector, analytics export). We're only changing what gets written into them at signup.

### Out of scope

- Backfilling existing members whose `name` is just a first name. (Happy to do this in a follow-up if you want — I'd merge `name + family_name` into `name` for members where `name` has no space and `family_name` is set.)
- Renaming the `family_name` column or splitting it into a dedicated `last_name` column.
- Changing the admin user card layout.

## Verification

- Sign up a new test user → onboarding shows First Name + Last Name fields → submit → admin Users tab shows the full "First Last" name in the card headline.
- Existing OAuth users (Google) get both fields pre-filled from `given_name` / `family_name`.