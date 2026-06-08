## Problem
The WhatsApp country code dropdown in registration (`CompleteProfile.tsx`) and profile editing (`Profile.tsx`) is a hardcoded 11-country list (GCC, Egypt, India, Pakistan, UK, US). Members from other countries — e.g. South Africa (+27) — cannot complete registration.

## Solution
Replace the hardcoded list with a comprehensive list of all ~240 ITU country dialing codes, and switch the picker from a plain `<Select>` to a searchable Combobox (shadcn `Command` + `Popover`) so users can quickly find their country by name or code on mobile.

## Changes

1. **New shared module** `src/lib/country-codes.ts`
   - Full list: `{ code: "+27", country: "South Africa", flag: "🇿🇦", label: "🇿🇦 +27" }`, etc. (all UN/ITU countries).
   - Helper `findCountryByDialCode(phone)` for prefilling from existing E.164 numbers.

2. **New component** `src/components/CountryCodeCombobox.tsx`
   - shadcn `Popover` + `Command` with searchable input (filters by country name or dial code).
   - Trigger shows selected flag + dial code (matches current visual).
   - Mobile-friendly: ≥44px tap target, scrollable list inside popover.

3. **Update `src/pages/CompleteProfile.tsx`**
   - Remove local `COUNTRY_CODES` constant.
   - Replace the `<Select>` with `<CountryCodeCombobox>`.
   - Default remains `+971`.

4. **Update `src/pages/Profile.tsx`**
   - Same swap for the WhatsApp + alternate-cell country pickers.
   - Use `findCountryByDialCode` to prefill from stored E.164 numbers (so existing `+27…` numbers display correctly instead of falling back to default).

5. **No changes** to validation (`isValidLocalNumber` already accepts 4–15 digits), DB schema, or E.164 formatting (`toE164` still just concatenates `code + cleaned local`).

## Out of scope
- Admin `EditUserModal` / `WalkInRsvpModal` — they don't use the country-code picker pattern.
- Server-side phone validation.
- Per-country length rules (kept as 4–15 digits to stay permissive).
