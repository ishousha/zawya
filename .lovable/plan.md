## Fixes for Dependents / Household form

### 1. Bug: Type dropdown not opening
In `FamilyEditor.tsx` the `<Select>` for Type sits inside a `<Dialog>` and its `SelectContent` has no explicit z-index, so the dialog overlay traps the click. Add `className="z-[120] bg-popover"` to the `SelectContent` (and to Gender's `SelectContent`) so they render above the dialog. Verify with the preview.

### 2. Date of birth should be optional
- Visually mark it optional: change label to `Date of birth (optional)` in both:
  - `src/components/admin/FamilyEditor.tsx` (DependentDialog)
  - `src/components/profile/DependentsSection.tsx` (when DOB is added there — see step 4)
- Logic already saves `null` when empty, no validation change needed.

### 3. Expanded Type list
New options (value → label):
- `son` → Son
- `daughter` → Daughter
- `father` → Father
- `mother` → Mother
- `maid` → Maid
- `nanny` → Nanny
- `driver` → Driver
- `househelper` → House Helper
- `other` → Other (please specify)

When `other` is selected, show a required free-text "Please specify" input. Store that text in a new `type_other` column (text, nullable).

Legacy values (`child`, `elder`, `helper`) stay readable but are no longer offered as new choices — `typeMeta` falls back to a generic icon/label for them.

### 4. Mirror changes in member profile
Update `src/components/profile/DependentsSection.tsx` so the "Add Dependent" form in **Profile → Family** uses the same expanded Type list, the same "Other – please specify" field, and an optional Date of birth input (replacing or alongside the current Age Group). Keep age group as-is for now; just add DOB and the new type list so the two surfaces stay consistent.

### 5. Database migration
- Drop existing `dependents_type_check` constraint and recreate it allowing: `son, daughter, father, mother, maid, nanny, driver, househelper, other, child, elder, helper` (keep the three legacy values so existing rows remain valid).
- Add column `type_other text` (nullable) to `public.dependents`.

### Files to touch
- `supabase/migrations/<new>.sql` (constraint + column)
- `src/components/admin/FamilyEditor.tsx` (TYPE_OPTIONS, SelectContent z-index, "Other" text input, DOB label)
- `src/components/profile/DependentsSection.tsx` (same TYPE_OPTIONS, "Other" text input, optional DOB field)

### Verification
- Open Admin → Families → Manage → Add dependent: confirm Type dropdown opens, all 9 options appear, "Other" reveals specify field, DOB can be left blank and Save succeeds.
- Repeat in Profile → Dependents section.
