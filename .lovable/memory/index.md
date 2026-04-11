# Project Memory

## Core
Zawya: Private spiritual community PWA. Sufi aesthetic: emerald primary, parchment bg, gold accents.
Playfair Display headings, Inter body. Mobile-first, bottom tab nav. WCAG AA.
Lovable Cloud enabled. RLS on all tables. Roles in user_roles table with has_role() function.
Store datetimes UTC, display in user's local timezone.
PWA configured with vite-plugin-pwa. SW disabled in dev/preview. Offline QR ticket caching.

## Memories
- [Design tokens](mem://design/tokens) — Emerald/parchment/gold palette, font families, animations
- [DB schema](mem://features/db-schema) — profiles, events (hybrid/waitlist/cover), user_roles, rsvps, event_sign_up_items, guest_requests tables
- [RSVP system](mem://features/rsvp) — Hooks, potluck logic, QR tickets, webhook placeholders
- [Admin dashboard](mem://features/admin-dashboard) — User/guest mgmt, event control (multi-tab form), QR door scanner
- [Event drafts](mem://features/event-drafts) — published boolean, Save Draft vs Publish buttons, RLS filters drafts from members
