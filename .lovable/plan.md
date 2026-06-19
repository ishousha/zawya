## Fix guest request card layout (Admin → Guests tab)

**Problem:** Each card uses a single horizontal flex row where the action buttons (status badge + 4 icon buttons, ~280px wide) consume most of the card width on mobile. The left column collapses to ~120px, forcing the guest name, requester info, phone, and the "Note from member" box to wrap into thin vertical sausages — one or two characters per line.

**Fix (purely presentational, in `src/components/admin/AllGuestApprovals.tsx`, the request `<Card>` block around lines 250–343):**

1. Convert the card body from a single flex row to a vertical stack:
   - Row 1: guest name + status badge inline (badge on the right, no longer competing with buttons).
   - Row 2: requester name, phone (compact muted text).
   - Row 3: "Note from member" box, now full card width so wrapping is natural (4–6 words per line instead of 1).
   - Row 4: action buttons in a right-aligned row (WhatsApp, Approve, Reject, Delete).

2. Tighten the note box: smaller header chip ("Note from member" inline label), comfortable line-height, `break-words`, max-height with subtle scroll only if very long.

3. Keep buttons at 40×40 (accessibility) but move them out of the text column so they no longer squeeze it.

4. Truncate long guest names with `truncate` only on the name line — never on the note.

No data, hook, or business-logic changes. No changes to the event header/collapsible. No changes to the member-side guest UI.

### Before / after sketch

```text
BEFORE (cramped)              AFTER (readable)
┌──────────────────────┐      ┌────────────────────────────┐
│ Abdal…   [P][✓][✗][🗑]│      │ Abdullah Mears   [Pending] │
│ Req by               │      │ Requested by Yahya Van Rooy│
│ Yahya Van            │      │ +971 54 518 8895           │
│ Rooy                 │      │ ┌────────────────────────┐ │
│ +971 54              │      │ │ NOTE FROM MEMBER       │ │
│ 518 8895             │      │ │ Son of Hajj Idris      │ │
│ ┌────────┐           │      │ │ Mears. My partner at   │ │
│ │NOTE    │           │      │ │ Fitra Brews…           │ │
│ │FROM    │           │      │ └────────────────────────┘ │
│ │MEMBER  │           │      │           [💬][✓][✗][🗑]   │
│ │Son of  │           │      └────────────────────────────┘
│ │Hajj …  │           │
│ └────────┘           │
└──────────────────────┘
```
