## Deep links for Library resources (Awrad, litanies, etc.)

Mirror the event short-link pattern so members can share any resource and the recipient lands directly on it inside the Library — with sign-in required.

### URL shapes
- Canonical: `/library/:resourceId` (UUID)
- Short: `/r/:shortCode` (e.g. `/r/AWRAD-FAJR`) — redirects to canonical

Unauthenticated visitors hit Login; after sign-in we redirect back to the saved path.

### Database
Migration on `resources`:
- Add `short_code text unique` (nullable)
- Trigger to auto-generate a 6-char code on insert if blank (reuses the same alphabet as events)
- Helper `normalize_resource_short_code` + `next_unique_resource_short_code` (parallel to event helpers) so admins can pick custom slugs like `AWRAD-FAJR`

### Routing (`src/components/AppRoutes.tsx`)
- Extend `isSafeRedirectPath` allowlist with `/library/:id` and `/r/:code`
- Unauth routes: add `<Route path="/library/:resourceId" element={<LoginPage />} />` and `<Route path="/r/:shortCode" element={<LoginPage />} />`
- Authed non-tab routes: add the same paths pointing to a new `ResourceShortLinkRedirect` and a handler that opens the Library tab with the target resource

### Library deep-link handling (`src/pages/Library.tsx`)
- On mount, read `useParams` / `useLocation`: if `resourceId` (or resolved from short code) present:
  - Switch to Resources tab
  - Scroll the matching card into view, briefly highlight it (ring + pulse)
  - Auto-open the PDF viewer modal for PDFs, or auto-trigger the link/video for other types (configurable — default: open viewer for PDFs, highlight only for others)
- Clear the URL back to `/library` after handling (replaceState) so refresh doesn't reopen

### New page: `src/pages/ResourceShortLinkRedirect.tsx`
- Looks up `short_code` → resource id, navigates to `/library/:id` (replace)
- Handles not-found with a toast + redirect to `/library`

### Share UI
Reuse existing share dialog pattern. Add `src/lib/share-resource.ts` with `getResourceShareUrl(id, shortCode)` and a `useShareResource()` hook modeled after `useShareEvent` (Web Share API → fallback dialog with copy / WhatsApp / Email).

Mount the Share button in three places:
1. **Resource card** in `src/pages/Library.tsx` — small share icon in the card actions row
2. **PDF viewer modal** in `src/pages/Library.tsx` — share button in the modal header
3. **Admin Resource Management** in `src/components/admin/ResourceManagement.tsx` — share icon in the row actions; also show the short code in the edit form (read-only, with optional custom override)

### Out of scope
- No public access — links require sign-in (same allowlist gate as events)
- No analytics on link opens (can be added later)
- Recordings tab links not included in this pass (resources only); easy to extend after