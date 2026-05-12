## Problem
On mobile, the Library page scrolls horizontally — the whole page is shifted left, header reads "ry", tabs read "urces", and resource cards extend past the viewport.

## Cause
In `src/pages/Library.tsx`, each resource card title is structured as:

```tsx
<h3 className="... flex items-center gap-1.5">
  <span className="truncate">{res.title}</span>
  {isExternal && <ExternalLink ... />}
</h3>
```

The `<span>` is a flex child. In flexbox, children default to `min-width: auto`, so `truncate` (which relies on `overflow: hidden`) does not actually constrain the span when the title is one very long token (e.g. "Fotouh Al Ghayb…"). The span pushes `<h3>` wider than its `flex-1 min-w-0` parent, which pushes the card past `max-w-2xl`, which forces the whole `<main>` to overflow the viewport.

## Fix (single file, presentation only)
In `src/pages/Library.tsx` resource card markup:

1. Add `min-w-0` (and keep `truncate`) to the title `<span>` so it can actually shrink inside the flex `<h3>`.
2. Add `min-w-0` to the `<h3>` itself for safety.
3. Add `break-words` to the description `<p>` so unusually long unbroken words can't expand the card either.
4. Optionally add `overflow-hidden` to the outer `<Card>` as a belt-and-braces guard.

No layout, query, or business-logic changes. No edits to other files.

## Verification
- Reload Library at 420px width: header shows full "Library", tabs show "Resources" / "Past Gatherings" centered, no horizontal scroll.
- Long-titled resource ("Fotouh Al Ghayb…") truncates with ellipsis and the external-link icon stays visible on the right.
