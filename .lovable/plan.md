## What's happening

On the admin **Monitor** view (`EventRsvpDetail`), the Host Dashboard component is embedded above the `Guest List | Potluck Sign-ups` tabs. The Host Dashboard renders its own inline "Guest List" — and that one is broken (every row says "Unknown (1 adult)" because it pulls names through a different RPC than the tabs do). The tabbed list right below already shows the correct names, dependents, party size and check-in.

Same `HostDashboard` is also used standalone on the **Event Detail** page for assigned hosts who are not admins — there, the inline guest list is the only place a host can see who's coming, so we shouldn't delete it outright.

## Fix

Add a `hideGuestList` prop to `HostDashboard` and set it on the admin Monitor screen so the inline list disappears there, without touching the host-only Event Detail view.

### Changes

1. **`src/components/HostDashboard.tsx`**
   - Accept an optional `hideGuestList?: boolean` prop.
   - Wrap the existing Guest List block (the `<Separator />` + `<h4>Guest List</h4>` + list, ~lines 166–196) so it's only rendered when `!hideGuestList`.
   - Headcount cards (Total / Adults / Elders / Kids / Arrived) and the Potluck items block stay as-is.

2. **`src/components/admin/EventRsvpDetail.tsx`**
   - At the embedded usage (~line 333), pass `hideGuestList`:
     ```tsx
     <HostDashboard eventId={eventId} hideGuestList />
     ```

### Out of scope

- Not touching the underlying "Unknown" name mapping in `get_event_attendee_profiles` — once the duplicate is hidden in admin Monitor, hosts on Event Detail still get names from that RPC the way they always have. If you want, we can address that name-mapping bug as a separate follow-up.
- No changes to the Potluck section, the tabs, or any data fetching.
