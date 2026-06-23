## Goal
Make Library carousel tiles easier to identify on mobile phones — larger thumbnails, clearer type labels, and a visible title underneath instead of relying on the dark overlay.

## Changes

**1. Bigger tiles on mobile** (`src/components/library/FeaturedCard.tsx`)
- Bump width: `w-36 sm:w-40 md:w-44 lg:w-48` (from `w-24 sm:w-28 md:w-32 lg:w-36`).
- Keep `aspect-square` so height grows proportionally — still much shorter than the original tall carousel, but tiles roughly 50% larger on phones.

**2. Move title below the image, not over it**
- Remove the dark gradient overlay and the absolutely-positioned title inside the cover.
- Render the title under the tile in a 2-line clamp using `font-heading text-sm` for crisp readability on parchment background. This frees the cover art to be fully visible — important since covers/speaker photos/fallbacks are the main identifier.

**3. Stronger type chip**
- Keep the top-left chip but enlarge to `text-[10px]`, `h-5`, with a slightly more opaque background so "PODCAST / PDF / VIDEO" is legible at a glance on small screens.
- Drop the redundant baked-in label inside `CoverFallback` (pass `showLabel={false}`) to avoid double-labeling now that the chip is larger and the title sits below.

**4. Carousel spacing tweak** (`src/components/library/FeaturedCarousel.tsx`)
- Increase gap to `gap-4` and bottom padding to `pb-4` so the larger tiles + external titles breathe.
- Nudge nav buttons up (`-mt-6`) to sit centered on the new tile (not the title).

**5. Version bump** (`public/version.json` → 7).

## Out of scope
No DB changes, no admin UI changes, no changes to `RecentlyAddedSection` or `CoverFallback` visuals beyond the `showLabel` toggle. Category color palette and scroll/drag behavior stay as shipped.

## Files
- edit `src/components/library/FeaturedCard.tsx`
- edit `src/components/library/FeaturedCarousel.tsx`
- edit `public/version.json`
