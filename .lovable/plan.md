## Goals
1. Stop re-rendering the "Recently Added" carousel (and re-mounting its cover images / re-fetching signed URLs) every time the user toggles a category, type, speaker, or search filter.
2. Make the icon-only fallback tiles feel like first-class covers so resources without an uploaded image, speaker photo, or linked event cover don't visibly downgrade the strip.

## Scope
`src/pages/Library.tsx` and `src/components/library/` only. No DB, schema, or admin changes.

---

## 1. Render isolation for the carousel

Today `renderFeaturedCard` is a closure recreated on every `Library` render, so every filter keystroke unmounts/remounts each `ResourceCover` — that triggers a new signed-URL request and a fresh `<img>` load (visible flicker). Plan:

- Extract `FeaturedCard` into `src/components/library/FeaturedCard.tsx` wrapped in `React.memo`. Props: `resource`, `speakerImage`, `eventCover`, `meta` (Icon + label), `onSelect`.
- Extract `RecentlyAddedSection` into `src/components/library/RecentlyAddedSection.tsx` wrapped in `React.memo`. Props: `resources`, `speakerById`, `eventById`, `getResourceMeta`, `onSelect`. It owns the `FeaturedCarousel` and maps to `FeaturedCard`.
- In `Library.tsx`:
  - Stabilize `handleResourceClick` with `useCallback`.
  - Stabilize `getResourceMeta` (it's pure) with `useCallback` or hoist to module scope.
  - `speakerById` / `eventById` already come from `useMemo` queries — keep as-is so the memo compare is stable.
  - Pass the memoized props in.
- Net effect: changing `activeCategory`, `filterType`, `filterSpeaker`, `filterDate`, or `search` no longer causes `RecentlyAddedSection` to re-render, so signed URLs and `<img>` elements persist.

Also memoize the per-resource lookup inside the card (the linked-event + first-speaker derivation) so it doesn't recompute on internal re-renders.

## 2. Upgrade the icon-only fallback cover

Replace the current `CoverFallback` (two faint gold rings + tiny icon on parchment) with a richer Sufi-manuscript style tile that holds its own visual weight next to photo tiles.

New `CoverFallback` design:
- Background: soft diagonal gradient from `parchment-deep` → `parchment` → faint `primary/8`, giving depth.
- Decorative SVG layer (inline, no extra asset): an 8-point Sufi star + concentric arabesque rings drawn in `gold/25` strokes, rotated and offset; subtle so it reads as texture, not chrome.
- Centered emblem: 56px gold-rimmed roundel (gradient `gold/15` → `gold/30`) with the resource-type `Icon` at `h-7 w-7 text-primary`.
- Bottom-left type label baked into the cover ("Podcast", "Playlist", "Recording", "PDF", etc.) in `font-heading text-[10px] uppercase tracking-[0.18em] text-primary/80`, so even a fallback tile communicates type at a glance.
- Deterministic tint per resource (hash of `res.id` → one of 4 Sufi accents: emerald, olive, clay, gold) applied to the gradient stop and the star stroke, so adjacent fallback tiles don't look identical.
- Same component works at any size: carousel square tile, list-card 56px thumbnail, PDF-viewer thumb. The list-card variant hides the bottom label (no room) but keeps the gradient + star + emblem.

Acceptance check: place a row of 3 fallback + 3 photo tiles side by side — fallbacks should look intentional, not "missing image".

## 3. Out of scope
- No new DB column, no admin UI change, no AI-generated covers.
- Carousel scroll/drag behavior, sizing, and category palette stay exactly as last shipped.

## 4. Files
- `src/pages/Library.tsx` — extract pieces, add `useCallback`s, hoist `getResourceMeta` if pure, swap fallback usage.
- `src/components/library/FeaturedCard.tsx` (new, memoized).
- `src/components/library/RecentlyAddedSection.tsx` (new, memoized).
- `src/components/library/CoverFallback.tsx` (new, replaces inline version).
- `public/version.json` — bump to v6.
