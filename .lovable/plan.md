## Library polish: compact carousel, real covers, on-theme palette

### 1. Carousel — compact square cover tiles
Replace the current `w-60 aspect-[4/5]` emerald-gradient cards with cleaner album/cover tiles.

- Tile size: `w-36` (144px), `aspect-square`, `rounded-2xl`, `gap-3`.
- Section becomes a horizontal strip ~150px tall (was ~340px) — roughly **2.3 tiles** visible per screen.
- Render order inside each tile:
  - Full-bleed cover image (see §2 for source).
  - Subtle bottom gradient `from-black/70 via-black/20 to-transparent` so the title is legible.
  - Type chip top-left: small parchment pill with `Icon` + label (no gold fill — `bg-card/90 backdrop-blur` + `text-foreground`).
  - 2-line title at the bottom in `font-heading text-sm`.
  - No date/speaker line in the tile (keeps it clean; details live in the list card).
- Strip header keeps the existing "Recently Added" heading + 3-dot gold ornament, and now shows a small "→" affordance because the strip is scrollable.

### 2. Cover image system
Add an explicit cover field, with three fallbacks so existing rows still look good.

**Schema (migration):**
- `ALTER TABLE public.resources ADD COLUMN cover_image_url text;`
- New public Storage bucket `resource-covers` (public read), with admin-only insert/update/delete policy on `storage.objects`. Image upload only (jpg/png/webp).

**Admin form (`src/components/admin/ResourceManagement.tsx`):**
- Add an optional "Cover image" upload above the file/source picker (preview + remove).
- Upload to `resource-covers/{resourceId}-{timestamp}.{ext}`, store public URL in `cover_image_url`.

**Resolution helper in `Library.tsx`:**
```
getResourceCover(res) =>
  1. res.cover_image_url
  2. podcast?         → first speaker.image_url
  3. res.event_id     → linkedEvent.cover_photo_url   (fetch in same query as title/date_time)
  4. null             → render themed pattern tile (parchment bg + soft gold concentric arcs + centered type Icon)
```
The themed-pattern fallback uses only `bg-parchment`, `text-primary/70`, and a single decorative gold ring — no emerald flood-fill. Used in both the carousel tile and the list card's left thumbnail when no cover/speaker image exists.

### 3. Category palette — Sufi only
Replace the 8-color rainbow `CATEGORY_PALETTE` (emerald/amber/rose/sky/violet/teal/orange/fuchsia) with a curated 5-tone Sufi palette using existing design tokens:

| Tone | Bar | Tint | Icon/Text |
|---|---|---|---|
| Emerald (primary) | `bg-primary` | `bg-primary/8` | `text-primary` |
| Gold | `bg-gold` | `bg-gold/10` | `text-gold-foreground` |
| Olive | `bg-olive` *(new token)* | `bg-olive/10` | `text-olive-foreground` |
| Clay/terracotta | `bg-clay` *(new token)* | `bg-clay/10` | `text-clay-foreground` |
| Parchment-deep | `bg-parchment-deep` *(new token)* | `bg-parchment-deep/10` | `text-foreground` |

- Add `olive`, `clay`, `parchment-deep` semantic HSL tokens to `src/index.css` + `tailwind.config.ts` (muted Sufi hues: olive ~80° 25% 40%, clay ~20° 45% 55%, parchment-deep ~38° 30% 78%).
- `getCategoryColor` keeps its deterministic hash but now maps over the 5-tone palette so the same category always picks the same tone.
- Category pills and section group dividers (currently lightly colored) shift to these tones too, so the whole page stays inside the brand.

### 4. List card thumbnail (consistency)
- When `cover_image_url` exists, the list card's 56px left tile becomes an `<img>` cover (preserves rounded square).
- Podcast speaker-avatar tile is unchanged.
- Otherwise the icon tile uses the new category tint instead of the old rainbow tint.

### Out of scope
- No changes to filters, search, recordings tab, PDF viewer, or RSVP flow.
- No backfill of existing resources — they simply use fallbacks until an admin uploads a cover.

### Files touched
- DB migration (add column) + Storage bucket creation
- `src/index.css`, `tailwind.config.ts` — new tokens
- `src/pages/Library.tsx` — palette, carousel, cover resolver, list card thumbnail, query updates (linked event cover, resource cover field)
- `src/lib/event-columns.ts` or `linkedEvents` query — include `cover_photo_url`
- `src/components/admin/ResourceManagement.tsx` — cover image upload
- `public/version.json` — bump