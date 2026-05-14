# Fix Walk-In search not opening

## What's broken
On the Host Dashboard → "Add Walk-In" modal, tapping the **Search members…** field does nothing on mobile. The dropdown either won't open, or opens and won't accept taps reliably.

## Root cause
`WalkInRsvpModal.tsx` puts a Radix **Popover** (which contains a `cmdk` Command list) **inside** a Radix **Dialog**. The Popover renders in a portal outside the Dialog, and the Dialog's focus trap + `pointer-events: none` body lock intermittently blocks the trigger tap and the list interactions on iOS Safari. This is a known Radix interaction issue and matches the symptom exactly (session replay confirms the popover sometimes opens, sometimes doesn't).

## Fix
Drop the Popover entirely and render the `cmdk` Command **inline inside the Dialog** as a permanent searchable list. This is also a better mobile pattern: no nested layer, the search input is always focused, and tapping a member selects immediately.

### Changes (single file: `src/components/admin/WalkInRsvpModal.tsx`)

1. Remove `Popover`, `PopoverTrigger`, `PopoverContent`, `ChevronsUpDown` imports and the `comboOpen` state.
2. Replace the `<Popover>…</Popover>` block under "Select Member" with an inline layout:
   - When **no member selected**: show `<Command>` with `<CommandInput placeholder="Search members…" autoFocus>` and a `<CommandList className="max-h-64">` of `availableUsers` (same items, same `onSelect`).
   - When a member **is selected**: show a compact summary row (name + family + a "Change" ghost button that clears `selectedUserId` to bring the search back).
3. Keep the existing query, filter logic, headcount inputs, and Confirm button untouched.
4. Keep `CommandEmpty` showing "Loading…" / "No members found."

### Why this is safe
- Pure presentation change, no business logic, no DB changes.
- Same data flow, same mutation, same `availableUsers` filter (already excludes users with existing RSVP for the event).
- Removes the Radix Dialog ↔ Popover portal interaction that's causing the dead tap.

### Out of scope
No changes to the walk-in mutation, RLS, event_sign_up_items, or other admin screens.
