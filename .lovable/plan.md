## Bug
`EventCard` checks `event.allow_guests === false` to render the red "No guests allowed" badge, but `allow_guests` is not in `EVENT_PUBLIC_COLUMNS` (`src/lib/event-columns.ts`). Public event queries (HomeFeed, prefetch, etc.) therefore never return that field, so the condition is always falsy-but-not-`false` and the badge stays on "Guests allowed".

## Fix
Append `allow_guests` to the `EVENT_PUBLIC_COLUMNS` string in `src/lib/event-columns.ts`. No schema or component changes needed — the existing `=== false` check in `EventCard` and `RSVPModal` will then work for all event lists.

## Verify
Toggle "Allow Guest Requests" off on an event → reload feed → card shows red "No guests allowed" badge; toggle on → shows subtle "Guests allowed" badge.
