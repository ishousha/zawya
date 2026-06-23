# Fix podcast/resource card overflow on Library page

## Problem
On mobile, the resource list card (most visible on the Podcast filter) extends past the right edge of the screen. The "PODCAST" badge gets clipped and the description spills outside the card border.

## Root cause
The resource list is wrapped in `<div className="grid gap-3">` with no explicit columns. Grid items default to `min-width: auto`, so a long title or one-line description (with `truncate` / `line-clamp-1`) forces the implicit track wider than the parent. The card itself also lacks `min-w-0`, so flex/grid children can't shrink below their intrinsic width.

## Changes (frontend-only, `src/pages/Library.tsx`)

1. Replace the two list wrappers with a flex column layout:
   - Line ~706: `<div className="grid gap-3">` → `<div className="flex flex-col gap-3">` (filtered list)
   - Line ~745 area: same swap for the grouped-by-category `items.slice(0, 4)` wrapper
   - Line ~569 loading skeleton wrapper: same swap for consistency
2. Add `min-w-0` to the card root (line ~608) so the inner `flex-1 min-w-0` text column can actually shrink:
   `className="group cursor-pointer ... rounded-2xl p-3 flex gap-3 min-w-0 ..."`
3. Bump `public/version.json` to 8.

## Out of scope
- No changes to the carousel, FeaturedCard, CoverFallback, or RecentlyAddedSection
- No changes to filters, search, data fetching, or DB
- No visual restyle of the card itself — only the width constraint
