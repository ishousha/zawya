## Goal

On the home page event card, the Share Event button should sit **beside** Add to Calendar (not stacked underneath), and that pair should appear **below** the Current Menu (Potluck) section.

## Change

**File:** `src/components/EventCard.tsx`

1. Remove the existing `{isAttending && <AddToCalendarButton />}` and the Share Event `<Button>` block from the action stack (currently at lines ~559–568, inside the `!isPast && !isCancelled` actions container).

2. After the `<PotluckMenu />` block (line ~580), add a new flex row that renders both buttons side-by-side, gated by the same `!isPast && !isCancelled` condition that wraps the actions today:

   ```tsx
   {!isPast && !isCancelled && (isAttending || true) && (
     <div className="mt-3 flex items-center gap-2">
       {isAttending && (
         <div className="flex-1">
           <AddToCalendarButton event={event} />
         </div>
       )}
       <Button
         size="sm"
         variant="ghost"
         className="flex-1 gap-1.5 text-muted-foreground hover:text-foreground"
         onClick={() => openShare(event.id, event.title, (event as any).short_code)}
       >
         <Share2 className="h-3.5 w-3.5" />
         Share Event
       </Button>
     </div>
   )}
   ```

   - When the user is attending: both buttons render side-by-side (50/50).
   - When not attending: only Share renders (full width via `flex-1`), preserving today's behavior of always showing Share to non-attendees.

3. No changes to the Potluck Menu component, the share dialog, or any other action (RSVP, Check-in, virtual link box).

## Out of scope

- No changes to the admin "Share Event" button on `EventDetail`.
- No styling changes to `AddToCalendarButton` itself (it already renders full-width inside its container).
- No change to past or cancelled event behavior.
