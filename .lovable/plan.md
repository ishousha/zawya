## Goal

When dependents (kids/youth/elders) attend an event, show their **age group** everywhere we list them so organizers can plan activities accordingly.

## What changes

### 1. Capture age group on RSVP (`src/components/RSVPModal.tsx`)

In `buildAttendingDependents()`, include `age_group` (e.g. `infant_0_3`, `child_4_12`, `youth_13_17`, `adult_18_plus`) from the dependent record into each saved entry. No schema change — `attending_dependents` is jsonb.

### 2. Guest list table (`src/components/admin/EventRsvpDetail.tsx`)

In `getDepsDisplay`, render each dependent as `Name · [Age Group badge]`, using a small label map:
- Infant (0-3) · Child (4-12) · Youth (13-17) · Adult (18+) · Elder

Fall back to age in parentheses if `age_group` is missing (older RSVPs without it).

### 3. CSV export (`handleExportCsv` in same file)

Replace the single "Dependents/Guests" column with two columns:
- **Dependents/Guests** — names
- **Age Groups** — same order, comma-joined (e.g. `Child, Child, Youth`)

Also add **Kids Count**, **Youth Count**, **Elder Count** columns so the org can pivot easily.

### 4. Next Event Guest List preview + email (`supabase/functions/send-guest-list-reminder/index.ts` + `_shared/transactional-email-templates/guest-list-reminder.tsx`)

Currently shows `X adults, Y elders, Z kids` per family. Split kids into infants / children / youth using `age_group` (with age-based fallback). Per family row becomes e.g. `2 adults, 1 elder, 1 child, 1 youth`. Summary totals at top get the same breakdown.

### 5. Walk-In RSVP (`src/components/admin/WalkInRsvpModal.tsx`)

Briefly check — if it lets admins add anonymous kids, allow picking an age group. (Will confirm during build; if it only stores `childrenCount`, add an "age group" selector per child or a count-by-group field.)

## Out of scope

- No DB schema change. `attending_dependents` is jsonb and already flexible.
- No change to dependent management UI (already captures age_group).
- Old RSVPs saved before this change will gracefully fall back to age or no badge.

## Technical notes

- Single source of label map in a shared helper (`src/lib/age-group-labels.ts`) so guest list, CSV, and email function stay consistent. (Edge function gets its own inline copy since it can't import from `src/`.)
- Age-group derivation when missing: use existing logic from `RSVPModal.tsx` lines 408–411 (age bands → `infant`/`child`/`youth`/`adult`).
