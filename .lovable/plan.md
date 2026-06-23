## Library Redesign — "Elegant Sufi Manuscript"

Rebuild the Library tab's visual layer to match the selected direction. Keep all data fetching, filters, search, share, and admin behavior intact — only the presentation changes.

### Scope
- File: `src/pages/Library.tsx` (Resources tab presentation).
- New components in `src/components/library/`:
  - `ResourceTypeIcon.tsx` — maps resource_type + category to a Lucide icon (podcast→Mic, awrad→BookOpen, pdf→FileText, video→PlayCircle, audio→Headphones, link→ExternalLink, playlist→ListMusic).
  - `FeaturedResourceCard.tsx` — large 4:5 carousel tile with cover image, gradient overlay, type pill, speaker mini-avatar, Playfair title.
  - `ResourceListCard.tsx` — list row with 64×64 thumbnail tile (cover image OR icon tile in `bg-emerald-900/5`), title, one-line description, size/duration meta in `text-[#b45309]`, share button on right, hover swap to filled emerald tile.
  - `CategorySection.tsx` — italic Playfair section header with gold-gradient hairline divider.
- No DB or business-logic changes. No new fields required (cover thumbnail uses existing `cover_image_url` if present on resources; if absent, gracefully falls back to icon tile only — no schema change in this pass).

### Layout (mobile-first, fits inside existing AppHeader + BottomNav)
```text
Header (existing AppHeader stays)
  Library  (Playfair, emerald-900)
  "The Garden of Knowledge" (gold caps eyebrow)

Tabs: Resources | Recordings   (unchanged behavior)

[Resources tab]
  Search + filter bar (kept, restyled to match parchment)
  Category chip rail (kept)

  ── Recently Added ──────────────  View All
  ┌────────┐ ┌────────┐ ┌────────┐   (horizontal snap scroll, top 6 by date)
  │ cover  │ │ cover  │ │ cover  │
  │ pill   │ │ pill   │ │ pill   │
  │ title  │ │ title  │ │ title  │
  │ ◐ name │ │ ◐ name │ │ ◐ name │
  └────────┘ └────────┘ └────────┘

  ╌ Daily Awrad ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
  ▢ icon  Title                PDF
         description…
         342 KB           ⤓ share

  ╌ Podcasts ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌
  (avatar) Title              EPISODE
           speaker · 12 min
                            ⤓ share
  …
```

### Visual tokens (use existing emerald/parchment/gold)
- Backgrounds: `bg-parchment` (existing) or `bg-[hsl(var(--background))]`.
- Card surface: `bg-white/60` with `border-[hsl(var(--gold)/0.15)]`, hover `bg-white shadow-lg shadow-emerald-900/5`.
- Section headers: italic Playfair, color `text-[hsl(var(--gold))]`, with `bg-gradient-to-r from-[hsl(var(--gold)/0.3)] to-transparent` divider.
- Meta text: `text-[hsl(var(--accent-foreground))]` (warm amber) uppercase tracked.
- All colors via existing semantic tokens — no hardcoded hex in components.

### Behavior preserved
- Search, category chip filter, speaker filter, sort.
- Active category filter hides the Recently Added carousel and collapses to a single filtered list.
- "All" view shows: Recently Added carousel (top 6 by `resource_date`/`created_at`) + sections grouped by category in alphabetical order.
- Tap card → existing open behavior (PDF viewer dialog / external link / file download).
- Share button → existing `ShareResourceDialog`.
- Podcast detection: `resource_type === 'podcast'` OR `category` contains "podcast" → render speaker avatar (first speaker in `speaker_ids`) instead of icon tile.

### Technical notes
- Use Lucide icons (already a dep). No fonts to install (Playfair + Inter already loaded).
- Carousel: native `flex overflow-x-auto snap-x` with `scrollbar-hide`.
- Speaker avatar source: existing `speakers` query in `Library.tsx` — pass `speakerById` map down.
- Recordings tab unchanged in this pass.
- Bump `public/version.json`.

### Out of scope
- No new DB columns (cover image uses existing field if any; otherwise icon-only).
- Recordings tab restyle (separate follow-up if desired).
- No admin UI changes.
