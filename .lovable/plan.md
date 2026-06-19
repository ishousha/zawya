## Saved external guests (reusable contacts + analytics)

Today every guest request is typed from scratch into the form — name, email, phone, note. We'll add a per-member address book of "saved external guests" so they can be picked instantly and tracked over time.

### Database
New table `public.external_guests`:
- `id uuid pk`
- `owner_id uuid not null` → `auth.users` (the member who saved this guest)
- `name text not null`
- `email text` (nullable)
- `phone text` (nullable)
- `notes text` (nullable, e.g. "vegetarian", "wife of X")
- `times_invited int default 0`
- `times_approved int default 0`
- `times_attended int default 0`
- `last_invited_at timestamptz`
- `last_attended_at timestamptz`
- `created_at`, `updated_at`
- Unique index on `(owner_id, lower(name), coalesce(phone,''))` to prevent obvious duplicates.

Add `external_guest_id uuid` (nullable, FK → `external_guests.id` on delete set null) to `public.guest_requests` to link a request to a saved guest.

**Grants & RLS**
- `GRANT SELECT, INSERT, UPDATE, DELETE … TO authenticated; GRANT ALL … TO service_role;`
- Policies on `external_guests`:
  - Owner can do all (`owner_id = auth.uid()`).
  - Admin/moderator can read all (uses `has_role`) for analytics dashboards.
- Trigger on `guest_requests`:
  - On insert with `external_guest_id`: bump `times_invited`, set `last_invited_at`.
  - On status change to `approved`: bump `times_approved`.
  - On linked RSVP check-in (existing flow already writes back to `guest_requests`? — if not, we update `times_attended` from a new trigger on `rsvps` joined via `guest_requests`). To stay simple, increment `times_attended` when the request row's `status` transitions to a future `attended` flag OR via a daily admin recompute. For v1, expose `times_attended` as `times_approved` minus cancellations — we'll wire actual attendance later if needed.

### Member UI (`src/components/rsvp/GuestRequestsSection.tsx`)
Add a "Saved guests" combobox at the top of the request form:
- Search by name; selecting fills name/email/phone/notes and stores `external_guest_id` on the request.
- "Save this guest for next time" checkbox (default on) when typing a new guest. On submit, upsert into `external_guests` and link the new row.
- "Manage saved guests" link → small modal listing the member's saved guests with edit/delete and quick stats (times invited / approved).

### Admin UI
Add a new tab card in Admin → Users (or a new "Guests" sub-tab) called **External Guests Directory**:
- Table of all `external_guests` joined with owner name.
- Columns: Guest name, Owner (member), Email, Phone, Times invited, Times approved, Last invited, Last attended.
- Search + sort. CSV export. Click row → detail drawer with the list of past requests and which events they attended (joining `guest_requests` + `events`).
- This gives the requested "statistics and pattern" view per guest.

### Files touched
- `supabase/migrations/<new>.sql` — new table, FK column, trigger, grants, policies.
- `src/components/rsvp/GuestRequestsSection.tsx` — saved-guest picker + save toggle + manage modal (split into a new `SavedGuestsPicker.tsx` for clarity).
- `src/components/admin/ExternalGuestsDirectory.tsx` (new) — admin directory + detail drawer.
- `src/pages/AdminDashboard.tsx` — register the new admin section/tab.
- `src/hooks/useExternalGuests.ts` (new) — list/create/update/delete hooks scoped to current user (and an admin-wide variant).

### Verification
- Save a new guest while creating a request → it appears in the picker next time and pre-fills all fields.
- Counters: invite the same saved guest twice → `times_invited` = 2; approve once → `times_approved` = 1; last_invited_at updates.
- Admin directory lists every member's saved guests with stats; clicking a row shows their request history.
- RLS: a second member cannot see another member's saved guests; admins can.
