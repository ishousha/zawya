## Plan

### Problem
- Event cards currently show a "Guests allowed" badge when `allow_guests` is true.
- The user wants this hidden so members aren't encouraged to bring guests.
- Only the red "No guests allowed" badge should appear when `allow_guests` is explicitly false.

### Changes
1. **EventCard.tsx**: Remove the `else` branch that renders the "Guests allowed" badge. Keep the conditional that shows the red "No guests allowed" badge when `allow_guests === false`.

2. **Default verification**: `defaultEventForm` in `types.ts` already sets `allow_guests: true`, so new events will continue to have guests allowed by default with no badge shown.

### Result
- Event cards show no guest-related badge when guests are allowed.
- Event cards show a red "No guests allowed" badge when the admin toggles it off.
- No database or settings changes needed.