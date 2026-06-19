# Analytics & Exports — Implementation Plan

## Part 1 — Backend (Supabase migration)

Create one migration containing a single RPC `public.get_user_analytics_export(date_from timestamptz default null, date_to timestamptz default null)`.

Properties:
- `SECURITY DEFINER`, `STABLE`, `SET search_path = public`.
- First line: `IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Access denied' USING ERRCODE='42501'; END IF;`
- `REVOKE EXECUTE ... FROM public, anon`; `GRANT EXECUTE ... TO authenticated`.

Shape (single query, one row per `profiles` row):

```text
profiles p
LEFT JOIN dependents d
  ON d.parent_id = p.id OR (p.family_id IS NOT NULL AND d.family_id = p.family_id)
LEFT JOIN rsvps r
  ON r.user_id = p.id
  AND (date_from IS NULL OR r.created_at >= date_from)
  AND (date_to   IS NULL OR r.created_at <= date_to)
LEFT JOIN events e
  ON e.id = r.event_id
  AND (date_from IS NULL OR e.date_time >= date_from)
  AND (date_to   IS NULL OR e.date_time <= date_to)
```

Aggregations use `COUNT(DISTINCT d.id)` for `dependent_count` and `COUNT(DISTINCT r.id) FILTER (...)` for RSVP/check-in metrics to avoid join multiplication. Virtual vs in-person is decided by `e.zoom_link IS NOT NULL OR e.virtual_link IS NOT NULL OR e.online_link IS NOT NULL` on rows where `r.checked_in = true`.

Derived columns:
- `checkin_rate = ROUND(total_checkins::numeric / NULLIF(total_rsvps,0) * 100, 2)` (coalesce to 0).
- `last_checkin_date = MAX(r.updated_at) FILTER (WHERE r.checked_in)::date`.
- `days_since_checkin = CURRENT_DATE - last_checkin_date`.
- `engagement_status` CASE on `last_checkin_date` (Never Attended / Active ≤30 / Lapsed ≤90 / Inactive).
- `avg_events_per_month = ROUND(total_checkins / GREATEST(months_in_window, 1), 2)` where `months_in_window` uses the date range if supplied, else months since `p.created_at`.

Returns the exact columns listed in the spec, in that order. No existing tables touched.

## Part 2 — Frontend

New file `src/components/admin/AnalyticsExports.tsx`, lazy-loaded from `AdminDashboard.tsx` as a new admin-only tab `"reports"` with label "Analytics & Exports" and a `BarChart3`/`FileSpreadsheet` icon. Tab is wrapped in an admin-only guard (re-uses `profile.role === 'admin'`); since the dashboard already guards admin tabs, no extra redirect is needed, but the component itself early-returns if not admin.

### Structure

- Top: Quick Reports button row (All Active Members, Attendance Summary, Never Attended, Top Attendees, Lapsed Members). Each preset sets filters + column selection + sort, then triggers Run Report.
- Two-column layout (`md:grid-cols-[280px_1fr]`, collapsible on mobile via a `Collapsible`):
  - Left panel: Report Filters + Choose Columns (grouped checkboxes with per-group "select all").
  - Right panel: Run Report button, results table, pagination, row count + estimated size, warning banner if >1000 rows, export buttons.
- Bottom: Saved Reports cards (localStorage `zawya_saved_reports`), each restoring filters + columns; per-card delete.

### Data flow

- `useQuery` calls `supabase.rpc('get_user_analytics_export', { date_from, date_to })` only when Run Report is clicked (manual `refetch` / `enabled: false`).
- Returned rows typed via a local `AnalyticsRow` interface (no `any`); RPC return type augmented in `src/integrations/supabase/types.ts` after migration regen.
- Client-side filtering for: gender multi-select, engagement status multi-select, mureed toggle (All/Only/Exclude), min RSVPs, min check-ins.
- Sorting + pagination (50/page) handled in `useMemo` over filtered rows.
- Date formatting via a small `formatDMY(date)` helper (`dd/MM/yyyy`), percentage via `${n.toFixed(2)}%`.

### Exports

Add deps: `papaparse`, `xlsx`, `jspdf`, `jspdf-autotable` (+ types). Export buttons disabled until columns selected AND report has been run. Each:
- CSV via Papa.unparse, saved with `Zawya_Report_YYYY-MM-DD.csv`.
- XLSX via `XLSX.utils.aoa_to_sheet`, bold header via cell style, sheet "Zawya Report".
- PDF via jsPDF + autoTable: header with existing logo asset (reuse `src/assets` logo already used by `AppHeader`), title "Analytics Report", date range, generated timestamp; alternating row shading via `alternateRowStyles`.
- Each export uses local loading state and shows a `toast.success` with filename.

### Empty / loading states

- Skeleton rows while RPC loading.
- Friendly empty state (icon + "No members match these filters") when filtered set is empty.
- Error toast if RPC throws (e.g. "Access denied").

## Part 3 — Guardrails respected

- No table modifications; RPC is the only data source for this feature.
- All displayed/exported dates DD/MM/YYYY; rates formatted `xx.xx%`.
- Tab hidden from non-admins by the existing admin guard; component also returns `null` for safety.
- Strict TypeScript throughout (explicit `AnalyticsRow`, `ColumnKey`, `SavedReport` types).
- All gender / engagement / mureed / min-RSVP / min-checkin filters applied client-side after RPC.

## Files

- New migration: `get_user_analytics_export` RPC + grants.
- New: `src/components/admin/AnalyticsExports.tsx` (single file; may split helpers into `src/lib/analytics-export.ts` if it grows past ~400 lines).
- Edit: `src/pages/AdminDashboard.tsx` — register new lazy tab + trigger.
- `package.json` — add `papaparse`, `xlsx`, `jspdf`, `jspdf-autotable`, `@types/papaparse`.

## Out of scope

- Server-side pagination or caching of report results.
- Persisting saved reports to the database (localStorage only, as specified).
- Scheduling / emailing reports.
