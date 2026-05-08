## Goal
Add a "Check In" quick-action on the admin Home Screen that appears only when an event is currently live and jumps directly to the Check-in tab pre-selected to that live event.

## Changes

### 1. `src/components/AdminQuickActions.tsx`
- Add a new query `admin-live-event` that returns the currently-live event (if any) — uses the same logic introduced in AdminQuickActions/AdminDoorScanner: status active/full, published, started in past, effective end (or `start + 6h`) in future.
- Conditionally render a 5th `QuickActionCard`:
  - Icon: `ScanLine` (lucide)
  - Label: "Check In (Live)"
  - Pulsing emerald dot + subtle highlight to make it stand out from other cards.
  - Hidden entirely when no live event exists.
- On click: `navigate("/admin", { state: { tab: "scanner", eventId: liveEvent.id } })`.
- Adjust grid to handle 5 items gracefully (`grid-cols-2 md:grid-cols-5`, or keep `md:grid-cols-4` and let it wrap — pick `md:grid-cols-5` so they stay one row on desktop; mobile stays 2-col and wraps).

### 2. `src/pages/AdminDashboard.tsx`
- No code changes needed: the existing tab-switch effect already supports `state.tab === "scanner"`. The `eventId` is forwarded (not consumed for non-events tabs today) — see step 3 for consumption.
- Update the "clear state" guard so eventId is preserved for the `scanner` tab (so AdminDoorScanner can read it), then cleared after consumption — same pattern as EventControlRoom.

### 3. `src/components/admin/AdminDoorScanner.tsx`
- Add a `useLocation` + `useNavigate` effect: if `location.state?.tab === "scanner"` and `state.eventId`, call `setSelectedEventId(state.eventId)`, then `navigate(pathname, { replace: true, state: null })` to clear.
- This overrides the auto-select-live behavior when an explicit eventId is passed (so we honor the user's click intent).

## Out of scope
- No DB changes, no design system token changes.
- No changes to scanner/manual-check-in logic.

## Verification
- With a live event: new "Check In (Live)" card appears on admin home with pulsing dot. Click → lands on Check-in tab with the live event already selected on first click.
- Without a live event: card is hidden; other quick actions look the same.
- Hard reload `/admin` after click → state cleared; refreshing doesn't retrigger navigation.
