import { useEffect, useMemo, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Loader2, Download, FileSpreadsheet, FileText, FileType2,
  ChevronDown, ChevronUp, Inbox, Trash2, Save, Play, AlertTriangle,
  ArrowUp, ArrowDown,
} from "lucide-react";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import zawyaLogo from "@/assets/zawya-logo.png";

// ---------- Types ----------
interface AnalyticsRow {
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  gender: string | null;
  age: number | null;
  family_name: string | null;
  member_since: string | null;
  is_mureed: boolean | null;
  dependent_count: number;
  total_rsvps: number;
  total_checkins: number;
  no_shows: number;
  checkin_rate: number;
  guests_brought: number;
  virtual_events_attended: number;
  inperson_events_attended: number;
  last_checkin_date: string | null;
  days_since_checkin: number | null;
  engagement_status: "Active" | "Lapsed" | "Inactive" | "Never Attended";
  avg_events_per_month: number;
}

type ColumnKey = keyof AnalyticsRow;

interface ColumnDef {
  key: ColumnKey;
  label: string;
  group: "Member Info" | "Dependents" | "Attendance" | "Event Types" | "Engagement";
  format?: "date" | "percent" | "boolean" | "number";
}

const COLUMNS: ColumnDef[] = [
  { key: "full_name", label: "Full Name", group: "Member Info" },
  { key: "email", label: "Email", group: "Member Info" },
  { key: "phone", label: "Phone", group: "Member Info" },
  { key: "whatsapp", label: "WhatsApp", group: "Member Info" },
  { key: "gender", label: "Gender", group: "Member Info" },
  { key: "age", label: "Age", group: "Member Info" },
  { key: "family_name", label: "Family Name", group: "Member Info" },
  { key: "member_since", label: "Member Since", group: "Member Info", format: "date" },
  { key: "is_mureed", label: "Is Mureed", group: "Member Info", format: "boolean" },
  { key: "dependent_count", label: "Dependent Count", group: "Dependents", format: "number" },
  { key: "total_rsvps", label: "Total RSVPs", group: "Attendance", format: "number" },
  { key: "total_checkins", label: "Total Check-ins", group: "Attendance", format: "number" },
  { key: "no_shows", label: "No-shows", group: "Attendance", format: "number" },
  { key: "checkin_rate", label: "Check-in Rate", group: "Attendance", format: "percent" },
  { key: "guests_brought", label: "Guests Brought", group: "Attendance", format: "number" },
  { key: "virtual_events_attended", label: "Virtual Events Attended", group: "Event Types", format: "number" },
  { key: "inperson_events_attended", label: "In-Person Events Attended", group: "Event Types", format: "number" },
  { key: "last_checkin_date", label: "Last Check-in Date", group: "Engagement", format: "date" },
  { key: "days_since_checkin", label: "Days Since Check-in", group: "Engagement", format: "number" },
  { key: "engagement_status", label: "Engagement Status", group: "Engagement" },
  { key: "avg_events_per_month", label: "Avg Events / Month", group: "Engagement", format: "number" },
];

const GROUPS: ColumnDef["group"][] = [
  "Member Info", "Dependents", "Attendance", "Event Types", "Engagement",
];

const ENGAGEMENT_VALUES = ["Active", "Lapsed", "Inactive", "Never Attended"] as const;
type EngagementValue = (typeof ENGAGEMENT_VALUES)[number];

interface Filters {
  dateFrom: string;
  dateTo: string;
  genders: string[];
  engagement: EngagementValue[];
  mureed: "all" | "only" | "exclude";
  minRsvps: string;
  minCheckins: string;
}

const DEFAULT_FILTERS: Filters = {
  dateFrom: "",
  dateTo: "",
  genders: [],
  engagement: [],
  mureed: "all",
  minRsvps: "",
  minCheckins: "",
};

interface SavedReport {
  id: string;
  name: string;
  filters: Filters;
  columns: ColumnKey[];
  createdAt: string;
}

const SAVED_KEY = "zawya_saved_reports";
const PAGE_SIZE = 50;

// ---------- Formatters ----------
function formatDMY(value: string | null): string {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}/${mm}/${yy}`;
}

function formatCell(row: AnalyticsRow, col: ColumnDef): string {
  const v = row[col.key];
  if (v === null || v === undefined) return "";
  if (col.format === "date") return formatDMY(v as string);
  if (col.format === "percent") return `${Number(v).toFixed(2)}%`;
  if (col.format === "boolean") return v ? "Yes" : "No";
  return String(v);
}

// ---------- Component ----------
export default function AnalyticsExports() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedColumns, setSelectedColumns] = useState<Set<ColumnKey>>(
    new Set(COLUMNS.map((c) => c.key))
  );
  const [rows, setRows] = useState<AnalyticsRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState<null | "csv" | "xlsx" | "pdf">(null);
  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<ColumnKey | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [topLimit, setTopLimit] = useState<number | null>(null);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(true);

  // Load saved reports
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVED_KEY);
      if (raw) setSavedReports(JSON.parse(raw) as SavedReport[]);
    } catch {
      /* ignore */
    }
  }, []);

  const persistSaved = useCallback((list: SavedReport[]) => {
    setSavedReports(list);
    localStorage.setItem(SAVED_KEY, JSON.stringify(list));
  }, []);

  // ---------- Run report ----------
  const runReport = useCallback(async (): Promise<AnalyticsRow[] | null> => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "get_user_analytics_export" as never,
        {
          date_from: filters.dateFrom ? new Date(filters.dateFrom).toISOString() : null,
          date_to: filters.dateTo ? new Date(filters.dateTo + "T23:59:59").toISOString() : null,
        } as never
      );
      if (error) throw error;
      const result = (data ?? []) as AnalyticsRow[];
      setRows(result);
      setPage(1);
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to run report";
      toast.error(msg);
      setRows(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo]);

  // ---------- Filter & sort client-side ----------
  const filtered = useMemo<AnalyticsRow[]>(() => {
    if (!rows) return [];
    const minR = filters.minRsvps ? Number(filters.minRsvps) : 0;
    const minC = filters.minCheckins ? Number(filters.minCheckins) : 0;
    return rows.filter((r) => {
      if (filters.genders.length && !filters.genders.includes(r.gender ?? "")) return false;
      if (filters.engagement.length && !filters.engagement.includes(r.engagement_status)) return false;
      if (filters.mureed === "only" && !r.is_mureed) return false;
      if (filters.mureed === "exclude" && r.is_mureed) return false;
      if (r.total_rsvps < minR) return false;
      if (r.total_checkins < minC) return false;
      return true;
    });
  }, [rows, filters]);

  const sorted = useMemo<AnalyticsRow[]>(() => {
    if (!sortKey) return filtered;
    const arr = [...filtered];
    arr.sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === null || av === undefined) return 1;
      if (bv === null || bv === undefined) return -1;
      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av).toLowerCase();
      const bs = String(bv).toLowerCase();
      return sortDir === "asc" ? as.localeCompare(bs) : bs.localeCompare(as);
    });
    return arr;
  }, [filtered, sortKey, sortDir]);

  const finalRows = useMemo<AnalyticsRow[]>(
    () => (topLimit ? sorted.slice(0, topLimit) : sorted),
    [sorted, topLimit]
  );

  const pageRows = useMemo<AnalyticsRow[]>(
    () => finalRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [finalRows, page]
  );
  const totalPages = Math.max(1, Math.ceil(finalRows.length / PAGE_SIZE));

  const activeColumns = useMemo<ColumnDef[]>(
    () => COLUMNS.filter((c) => selectedColumns.has(c.key)),
    [selectedColumns]
  );

  const availableGenders = useMemo<string[]>(() => {
    if (!rows) return [];
    const s = new Set<string>();
    rows.forEach((r) => {
      if (r.gender) s.add(r.gender);
    });
    return Array.from(s).sort();
  }, [rows]);

  // ---------- Column toggles ----------
  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: ColumnDef["group"]) => {
    const groupKeys = COLUMNS.filter((c) => c.group === group).map((c) => c.key);
    const allOn = groupKeys.every((k) => selectedColumns.has(k));
    setSelectedColumns((prev) => {
      const next = new Set(prev);
      if (allOn) groupKeys.forEach((k) => next.delete(k));
      else groupKeys.forEach((k) => next.add(k));
      return next;
    });
  };

  // ---------- Quick reports ----------
  const memberInfoCols: ColumnKey[] = COLUMNS.filter((c) => c.group === "Member Info").map((c) => c.key);

  const applyQuick = useCallback(async (preset: string) => {
    let nextFilters: Filters = { ...DEFAULT_FILTERS };
    let nextCols: ColumnKey[] = COLUMNS.map((c) => c.key);
    let nextSort: { key: ColumnKey; dir: "asc" | "desc" } | null = null;
    let nextTop: number | null = null;

    switch (preset) {
      case "active":
        nextFilters = { ...DEFAULT_FILTERS, engagement: ["Active"] };
        nextCols = memberInfoCols;
        break;
      case "summary":
        nextCols = [
          "full_name", "email", "total_rsvps", "total_checkins",
          "checkin_rate", "last_checkin_date",
        ];
        break;
      case "never":
        nextFilters = { ...DEFAULT_FILTERS, engagement: ["Never Attended"] };
        nextCols = [...memberInfoCols, "total_rsvps", "total_checkins"];
        break;
      case "top":
        nextSort = { key: "total_checkins", dir: "desc" };
        nextTop = 50;
        nextCols = [
          "full_name", "email", "total_rsvps", "total_checkins",
          "checkin_rate", "guests_brought", "last_checkin_date",
        ];
        break;
      case "lapsed":
        nextFilters = { ...DEFAULT_FILTERS, engagement: ["Lapsed"] };
        nextSort = { key: "days_since_checkin", dir: "desc" };
        nextCols = [
          "full_name", "email", "phone", "last_checkin_date",
          "days_since_checkin", "total_checkins",
        ];
        break;
    }
    setFilters(nextFilters);
    setSelectedColumns(new Set(nextCols));
    setSortKey(nextSort?.key ?? null);
    setSortDir(nextSort?.dir ?? "asc");
    setTopLimit(nextTop);
    await runReport();
  }, [memberInfoCols, runReport]);

  // ---------- Exports ----------
  const buildExportMatrix = useCallback((): { headers: string[]; data: string[][] } => {
    const headers = activeColumns.map((c) => c.label);
    const data = finalRows.map((r) => activeColumns.map((c) => formatCell(r, c)));
    return { headers, data };
  }, [activeColumns, finalRows]);

  const todayStamp = () => {
    const d = new Date();
    const yy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yy}-${mm}-${dd}`;
  };

  const exportCsv = async () => {
    setExporting("csv");
    try {
      const { headers, data } = buildExportMatrix();
      const csv = Papa.unparse({ fields: headers, data });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const filename = `Zawya_Report_${todayStamp()}.csv`;
      triggerDownload(blob, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "CSV export failed");
    } finally {
      setExporting(null);
    }
  };

  const exportXlsx = async () => {
    setExporting("xlsx");
    try {
      const { headers, data } = buildExportMatrix();
      const aoa = [headers, ...data];
      const ws = XLSX.utils.aoa_to_sheet(aoa);
      // bold headers
      headers.forEach((_, i) => {
        const cell = XLSX.utils.encode_cell({ r: 0, c: i });
        if (ws[cell]) ws[cell].s = { font: { bold: true } };
      });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Zawya Report");
      const filename = `Zawya_Report_${todayStamp()}.xlsx`;
      XLSX.writeFile(wb, filename);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Excel export failed");
    } finally {
      setExporting(null);
    }
  };

  const exportPdf = async () => {
    setExporting("pdf");
    try {
      const { headers, data } = buildExportMatrix();
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();
      try {
        doc.addImage(zawyaLogo, "PNG", 40, 24, 40, 40);
      } catch {
        /* ignore logo failure */
      }
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Zawya Analytics Report", 90, 44);
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const range = filters.dateFrom || filters.dateTo
        ? `Range: ${filters.dateFrom ? formatDMY(filters.dateFrom) : "…"} → ${filters.dateTo ? formatDMY(filters.dateTo) : "…"}`
        : "Range: All time";
      doc.text(range, 90, 60);
      doc.text(`Generated: ${formatDMY(new Date().toISOString())} ${new Date().toLocaleTimeString()}`, pageWidth - 40, 60, { align: "right" });

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: 80,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [16, 82, 64], textColor: 255 },
        alternateRowStyles: { fillColor: [245, 240, 230] },
        margin: { left: 40, right: 40 },
      });

      const filename = `Zawya_Report_${todayStamp()}.pdf`;
      doc.save(filename);
      toast.success(`Downloaded ${filename}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PDF export failed");
    } finally {
      setExporting(null);
    }
  };

  // ---------- Saved reports ----------
  const saveCurrent = () => {
    const name = window.prompt("Name this report:");
    if (!name) return;
    const entry: SavedReport = {
      id: crypto.randomUUID(),
      name,
      filters,
      columns: Array.from(selectedColumns),
      createdAt: new Date().toISOString(),
    };
    persistSaved([entry, ...savedReports]);
    toast.success(`Saved "${name}"`);
  };

  const restoreSaved = (r: SavedReport) => {
    setFilters(r.filters);
    setSelectedColumns(new Set(r.columns));
    toast.success(`Loaded "${r.name}"`);
  };

  const deleteSaved = (id: string) => {
    persistSaved(savedReports.filter((r) => r.id !== id));
  };

  // ---------- Sort handler ----------
  const handleSort = (key: ColumnKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  // ---------- Estimated file size ----------
  const estimatedBytes = useMemo(() => {
    if (!finalRows.length || !activeColumns.length) return 0;
    const sample = finalRows.slice(0, 20).map((r) =>
      activeColumns.map((c) => formatCell(r, c)).join(",")
    ).join("\n");
    const avgRow = sample.length / Math.max(1, Math.min(20, finalRows.length));
    return Math.round(avgRow * finalRows.length);
  }, [finalRows, activeColumns]);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  };

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Admins only.
      </div>
    );
  }

  const canExport = activeColumns.length > 0 && rows !== null;

  return (
    <div className="space-y-4 py-2">
      {/* Quick Reports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Quick Reports</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => applyQuick("active")}>All Active Members</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("summary")}>Attendance Summary</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("never")}>Never Attended</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("top")}>Top Attendees</Button>
          <Button size="sm" variant="outline" onClick={() => applyQuick("lapsed")}>Lapsed Members</Button>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        {/* Filter & column panel */}
        <div className="space-y-4">
          <Card>
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer pb-3 flex-row items-center justify-between">
                  <CardTitle className="text-base">Report Filters</CardTitle>
                  {filtersOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3">
                  <div>
                    <Label className="text-xs">From</Label>
                    <Input
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">To</Label>
                    <Input
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                    />
                  </div>

                  <div>
                    <Label className="text-xs">Gender</Label>
                    <div className="space-y-1 mt-1">
                      {(availableGenders.length ? availableGenders : ["male", "female"]).map((g) => (
                        <label key={g} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={filters.genders.includes(g)}
                            onCheckedChange={(c) =>
                              setFilters((f) => ({
                                ...f,
                                genders: c
                                  ? [...f.genders, g]
                                  : f.genders.filter((x) => x !== g),
                              }))
                            }
                          />
                          <span className="capitalize">{g}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Engagement Status</Label>
                    <div className="space-y-1 mt-1">
                      {ENGAGEMENT_VALUES.map((s) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={filters.engagement.includes(s)}
                            onCheckedChange={(c) =>
                              setFilters((f) => ({
                                ...f,
                                engagement: c
                                  ? [...f.engagement, s]
                                  : f.engagement.filter((x) => x !== s),
                              }))
                            }
                          />
                          <span>{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs">Is Mureed</Label>
                    <Select
                      value={filters.mureed}
                      onValueChange={(v) => setFilters((f) => ({ ...f, mureed: v as Filters["mureed"] }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="only">Mureed only</SelectItem>
                        <SelectItem value="exclude">Non-mureed only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs">Min RSVPs</Label>
                    <Input
                      type="number"
                      min={0}
                      value={filters.minRsvps}
                      onChange={(e) => setFilters((f) => ({ ...f, minRsvps: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Min Check-ins</Label>
                    <Input
                      type="number"
                      min={0}
                      value={filters.minCheckins}
                      onChange={(e) => setFilters((f) => ({ ...f, minCheckins: e.target.value }))}
                    />
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                  >
                    Reset Filters
                  </Button>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Choose Columns</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {GROUPS.map((g) => {
                const groupCols = COLUMNS.filter((c) => c.group === g);
                const allOn = groupCols.every((c) => selectedColumns.has(c.key));
                return (
                  <div key={g}>
                    <label className="flex items-center gap-2 text-sm font-semibold">
                      <Checkbox checked={allOn} onCheckedChange={() => toggleGroup(g)} />
                      {g}
                    </label>
                    <div className="ml-6 mt-1 space-y-1">
                      {groupCols.map((c) => (
                        <label key={c.key} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={selectedColumns.has(c.key)}
                            onCheckedChange={() => toggleColumn(c.key)}
                          />
                          {c.label}
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right panel */}
        <div className="space-y-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={() => runReport()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Run Report
            </Button>
            <Button variant="outline" onClick={saveCurrent} disabled={!rows}>
              <Save className="h-4 w-4" /> Save this report
            </Button>
            <div className="ml-auto flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={exportCsv} disabled={!canExport || exporting !== null}>
                {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                CSV
              </Button>
              <Button variant="outline" size="sm" onClick={exportXlsx} disabled={!canExport || exporting !== null}>
                {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4" />}
                Excel
              </Button>
              <Button variant="outline" size="sm" onClick={exportPdf} disabled={!canExport || exporting !== null}>
                {exporting === "pdf" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileType2 className="h-4 w-4" />}
                PDF
              </Button>
            </div>
          </div>

          {finalRows.length > 1000 && (
            <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              This report contains {finalRows.length} rows. Export may take a few seconds.
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              {rows === null ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Download className="h-8 w-8" />
                  <p>Run a report to preview results.</p>
                </div>
              ) : loading ? (
                <div className="flex justify-center py-16">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : finalRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
                  <Inbox className="h-10 w-10" />
                  <p>No members match these filters.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeColumns.map((c) => (
                          <TableHead
                            key={c.key}
                            className="cursor-pointer whitespace-nowrap select-none"
                            onClick={() => handleSort(c.key)}
                          >
                            <span className="inline-flex items-center gap-1">
                              {c.label}
                              {sortKey === c.key &&
                                (sortDir === "asc"
                                  ? <ArrowUp className="h-3 w-3" />
                                  : <ArrowDown className="h-3 w-3" />)}
                            </span>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pageRows.map((r) => (
                        <TableRow key={r.user_id}>
                          {activeColumns.map((c) => (
                            <TableCell key={c.key} className="whitespace-nowrap">
                              {c.key === "engagement_status" ? (
                                <Badge variant="outline">{formatCell(r, c)}</Badge>
                              ) : (
                                formatCell(r, c)
                              )}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {rows !== null && finalRows.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <div>
                {finalRows.length} rows · ~{formatSize(estimatedBytes)}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <span>Page {page} / {totalPages}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Saved reports */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Saved Reports</CardTitle>
        </CardHeader>
        <CardContent>
          {savedReports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No saved reports yet.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {savedReports.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border bg-card p-3"
                >
                  <button
                    className="flex-1 text-left"
                    onClick={() => restoreSaved(r)}
                  >
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDMY(r.createdAt)} · {r.columns.length} cols
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteSaved(r.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
