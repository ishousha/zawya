## Library Polish — Match Events Page + Consistent Type Icons/Labels

Two small, targeted edits to `src/pages/Library.tsx`. No new files, no DB, no behavior change.

### 1. Section headers, dividers & spacing (match Events page)

Events page uses a clean `font-heading text-lg font-semibold text-foreground` header with `mb-4` and `space-y-3` lists — no italic, no full-width gold gradient line.

Library will follow the same rhythm while keeping a discreet Sufi accent:

- **"Recently Added" + per-category section headers**: switch from gold italic to `font-heading text-lg font-semibold text-foreground`. Add a small 3-dot gold ornament (`◆ ◆ ◆` or a 12px gold underline) under each header instead of the full gradient hairline, so the Sufi flavor stays without competing with Events visual weight.
- **Inter-section spacing**: change `space-y-8` → `space-y-6`. Inter-card spacing inside sections: `gap-3` (already matches Events).
- **Carousel header row**: align with Events' "Upcoming Activities" pattern — header left, subtle muted right-side meta ("6 new") in same size.
- **Page header**: tighten — remove the gold caps "The Garden of Knowledge" eyebrow (Events doesn't have one); keep the Playfair "Library" title and a single-line muted subtitle ("Resources & past gatherings"), matching the Events header structure.
- **"View all" link** in each category header: keep, but restyle to `text-xs font-medium text-primary` to match Events' "see more" affordance.

### 2. Consistent resource icons & labels everywhere

Create two small helpers at the top of the file:

```ts
function getResourceMeta(res) → { Icon, label }
// podcast  → Mic,        "Podcast"
// playlist → ListMusic,  "Playlist"
// awrad    → BookOpen,   "Awrad"
// video    → PlayCircle, "Video"
// audio    → Headphones, "Audio"
// link     → LinkIcon,   "Link"
// pdf      → FileText,   "PDF"
```

Use it in **all four places**:

1. **List card icon tile** — already uses `getResourceIcon(res)`; switch to `getResourceMeta`.
2. **List card corner label** — currently `(res.resource_type || "pdf").toUpperCase()` which mislabels podcasts/awrad. Use `meta.label.toUpperCase()`.
3. **Featured carousel top-right icon badge** — already uses `getResourceIcon(res)`; switch to `getResourceMeta`.
4. **PDF viewer modal header** — prepend a small `<Icon />` (16px) before the title so the user always sees the type while viewing.

### Out of scope
- No changes to filters, search, share dialog, or recordings tab.
- No new DB columns; podcast/awrad/playlist detection stays heuristic on `resource_type` + `category` + `tags` (already in place).
- No font or color-token additions.

### Files touched
- `src/pages/Library.tsx` (helper + 4 usage sites + header/section styling)
- `public/version.json` (bump)
