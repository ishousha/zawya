
## Goal
Make the "Don't forget to bring" section pop visually so members notice their assigned item. Current muted green blends with the parchment ticket.

## Color choice
Use a warm **amber/gold** palette — it's attention-grabbing, fits the existing emerald + brushed-gold Sufi aesthetic, and reads as a friendly reminder (not an error like red).

- Background: soft amber `#FEF3C7` (amber-100)
- Border (left accent stripe, 4px): `#F59E0B` (amber-500)
- Label "DON'T FORGET TO BRING": `#B45309` (amber-700), bold uppercase
- Item name: dark slate `#1F2937` (gray-800), bold
- Description/dish: `#78350F` (amber-900) for warm contrast

## Changes

### 1. QR Ticket — `src/components/QRTicketScreen.tsx`
Restyle the "Don't forget to bring" box:
- Replace current muted background with `bg-amber-50 border-l-4 border-amber-500`
- Label → `text-amber-700 font-bold uppercase tracking-wide`
- Item rows → bold gray-800 name, amber-900 description
- Keep the existing layout/structure intact

### 2. Reminder Email — `supabase/functions/_shared/transactional-email-templates/event-reminder.tsx`
Update the `bringBox`, `bringLabel`, `bringItem` inline styles:
- `bringBox`: `backgroundColor: '#FEF3C7'`, `borderLeft: '4px solid #F59E0B'`, padding, rounded
- `bringLabel`: `color: '#B45309'`, bold uppercase, letter-spacing
- `bringItem`: `color: '#1F2937'` bold for category, `#78350F` for dish description

### 3. Deploy
Redeploy `send-event-reminders` and `send-transactional-email` edge functions so the email change ships.

## Out of scope
No data model or copy changes — visual only.
