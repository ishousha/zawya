Replace the "$" currency symbol with "AED" in all event fee displays across the app.

## Files to change
1. `src/components/admin/event-form/SettingsTab.tsx` — Replace `DollarSign` icon with `Coins` icon (more currency-neutral) and add "AED" context to the Event Fee section.
2. `src/components/admin/event-form/EventPreviewDialog.tsx` — Change `💰 Fee: ${fee.toFixed(0)}` to `💰 Fee: ${fee.toFixed(0)} AED`.
3. `src/components/EventCard.tsx` — Change `💰 Fee: ${Number(event.ticket_fee).toFixed(0)}` to `💰 Fee: ${Number(event.ticket_fee).toFixed(0)} AED`.

The `RSVPModal.tsx` already uses AED and does not need changes.

## Technical notes
- No database changes needed.
- No new dependencies.
- Keep the same emoji (💰) and badge styling. Simply append " AED" after the numeric value.