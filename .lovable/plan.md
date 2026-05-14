## Problem

On the Check-in screen, the progress card shows three different numbers that don't agree with the Host Dashboard's "67 Total":

- Big number: `0/56` — counts RSVP **rows** (parties), not people
- Subtitle: `0 of 67 total guests arrived` — correct (headcount)
- `56 remaining` — RSVP rows again, not people

The Host Dashboard headcount of **67** (65 adults + 2 elders + 0 kids) is the source of truth.

## Fix

In `src/components/admin/AdminDoorScanner.tsx` (the Check-in Progress card around lines 382–401), switch the big counter and "remaining" to headcount units so all three numbers agree:

- Replace `{rsvpCounts.checkedIn}/{rsvpCounts.total}` → `{rsvpCounts.checkedInGuests}/{rsvpCounts.totalGuests}`
- Replace progress value denominator → `(checkedInGuests / totalGuests) * 100`
- Replace `{rsvpCounts.total - rsvpCounts.checkedIn} remaining` → `{rsvpCounts.totalGuests - rsvpCounts.checkedInGuests} remaining`

Result on the screenshot's event: big number becomes `0/67`, "67 remaining", subtitle stays `0 of 67 total guests arrived`.

## Scope

- One file, presentation-only
- No DB / RLS / hook / query changes
- Host Dashboard untouched (already correct)
