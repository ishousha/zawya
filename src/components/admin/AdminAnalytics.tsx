import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Users, Baby, Home, UserCheck, CalendarIcon, X, Download } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth, startOfDay, endOfDay, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

// ── Data hooks ──────────────────────────────────────────────

function useAllProfiles() {
  return useQuery({
    queryKey: ["analytics-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, role, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAllCounts() {
  return useQuery({
    queryKey: ["analytics-counts"],
    queryFn: async () => {
      const [familiesRes, dependentsRes] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("dependents").select("id, created_at"),
      ]);
      return {
        totalFamilies: familiesRes.count ?? 0,
        dependents: dependentsRes.data ?? [],
      };
    },
  });
}

function useAllEvents() {
  return useQuery({
    queryKey: ["analytics-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time")
        .order("date_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAllRsvps() {
  return useQuery({
    queryKey: ["analytics-rsvps"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, checked_in, created_at");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Preset helpers ──────────────────────────────────────────

const PRESETS = [
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 6 months", days: 180 },
  { label: "Last year", days: 365 },
] as const;

// ── Component ───────────────────────────────────────────────

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

export default function AdminAnalytics() {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const { data: profiles = [], isLoading: l1 } = useAllProfiles();
  const { data: counts, isLoading: l2 } = useAllCounts();
  const { data: events = [], isLoading: l3 } = useAllEvents();
  const { data: rsvps = [], isLoading: l4 } = useAllRsvps();

  const isLoading = l1 || l2 || l3 || l4;

  const rangeFrom = dateRange?.from ? startOfDay(dateRange.from) : undefined;
  const rangeTo = dateRange?.to ? endOfDay(dateRange.to) : dateRange?.from ? endOfDay(dateRange.from) : undefined;
  const hasRange = !!rangeFrom && !!rangeTo;

  const inRange = (dateStr: string) => {
    if (!hasRange) return true;
    const d = new Date(dateStr);
    return isWithinInterval(d, { start: rangeFrom!, end: rangeTo! });
  };

  // ── Filtered data ─────────────────────────────────────────

  const filteredProfiles = useMemo(() => profiles.filter((p) => inRange(p.created_at)), [profiles, rangeFrom, rangeTo]);
  const filteredDependents = useMemo(() => (counts?.dependents ?? []).filter((d) => inRange(d.created_at ?? "")), [counts, rangeFrom, rangeTo]);

  const approved = useMemo(() => {
    if (hasRange) return filteredProfiles.filter((p) => p.role === "approved" || p.role === "admin").length;
    return profiles.filter((p) => p.role === "approved" || p.role === "admin").length;
  }, [profiles, filteredProfiles, hasRange]);

  const pending = useMemo(() => {
    if (hasRange) return filteredProfiles.filter((p) => p.role === "pending").length;
    return profiles.filter((p) => p.role === "pending").length;
  }, [profiles, filteredProfiles, hasRange]);

  const totalDependents = hasRange ? filteredDependents.length : (counts?.dependents ?? []).length;
  const totalFamilies = counts?.totalFamilies ?? 0;

  // Pie data
  const pieData = [
    { name: "Adults", value: approved },
    { name: "Children", value: totalDependents },
  ].filter((d) => d.value > 0);

  // Event engagement – filter events in range, take top 5
  const engagement = useMemo(() => {
    const now = new Date();
    const pastEvents = events
      .filter((e) => new Date(e.date_time) <= now)
      .filter((e) => inRange(e.date_time))
      .slice(0, 5)
      .reverse();

    return pastEvents.map((evt) => {
      const evtRsvps = rsvps.filter((r) => r.event_id === evt.id);
      return {
        name: evt.title.length > 18 ? evt.title.slice(0, 18) + "…" : evt.title,
        rsvps: evtRsvps.length,
        checkins: evtRsvps.filter((r) => r.checked_in).length,
      };
    });
  }, [events, rsvps, rangeFrom, rangeTo]);

  // Growth line chart
  const growthData = useMemo(() => {
    const sourceProfiles = hasRange ? filteredProfiles : profiles;
    if (sourceProfiles.length === 0) return [];

    const now = new Date();
    let start: Date;
    let end: Date;

    if (hasRange) {
      start = startOfMonth(rangeFrom!);
      end = rangeTo!;
    } else {
      start = startOfMonth(subMonths(now, 5));
      end = now;
    }

    const months = eachMonthOfInterval({ start, end });
    return months.map((monthStart, i) => {
      const monthEnd = i < months.length - 1 ? months[i + 1] : new Date(end.getFullYear(), end.getMonth() + 1, 1);
      const count = sourceProfiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= monthStart && d < monthEnd;
      }).length;
      return { month: format(monthStart, "MMM yy"), signups: count };
    });
  }, [profiles, filteredProfiles, hasRange, rangeFrom, rangeTo]);

  // ── Date label ────────────────────────────────────────────

  const dateLabel = hasRange
    ? `${format(rangeFrom!, "MMM d, yyyy")} – ${format(rangeTo!, "MMM d, yyyy")}`
    : "All Time";

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.days}
            size="sm"
            variant="outline"
            className="text-xs"
            onClick={() => {
              const to = new Date();
              const from = new Date();
              from.setDate(from.getDate() - p.days);
              setDateRange({ from, to });
            }}
          >
            {p.label}
          </Button>
        ))}

        <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
          <PopoverTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs">
              <CalendarIcon className="h-3.5 w-3.5" />
              Custom Range
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) setCalendarOpen(false);
              }}
              numberOfMonths={2}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hasRange && (
          <Button size="sm" variant="ghost" className="gap-1 text-xs" onClick={() => setDateRange(undefined)}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={() => {
              const metricsRows = [
                { Metric: "Active Members", Value: approved },
                { Metric: "Pending Approvals", Value: pending },
                { Metric: "Total Families", Value: totalFamilies },
                { Metric: "Total Dependents", Value: totalDependents },
              ];
              const engagementRows = engagement.map((e) => ({
                Metric: `Event: ${e.name}`,
                Value: `${e.rsvps} RSVPs / ${e.checkins} Check-ins`,
              }));
              downloadCsv([...metricsRows, ...engagementRows], zawyaFilename("Analytics"));
              toast.success("Analytics exported");
            }}
          >
            <Download className="h-3.5 w-3.5" /> Export Metrics
          </Button>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<UserCheck className="h-5 w-5 text-primary" />} label={hasRange ? "Members (in range)" : "Active Members"} value={approved} />
        <KpiCard icon={<Users className="h-5 w-5 text-amber-500" />} label={hasRange ? "Pending (in range)" : "Pending Approvals"} value={pending} />
        <KpiCard icon={<Home className="h-5 w-5 text-primary" />} label="Total Families" value={totalFamilies} />
        <KpiCard icon={<Baby className="h-5 w-5 text-primary" />} label={hasRange ? "Dependents (in range)" : "Total Dependents"} value={totalDependents} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Community Demographics</h3>
            {pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No data yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Event Engagement (Top 5{hasRange ? " in range" : ""})</h3>
            {engagement.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No past events{hasRange ? " in this range" : ""}.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={engagement} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="rsvps" name="RSVPs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="checkins" name="Check-ins" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Line – Growth */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3">Member Sign-up Growth{hasRange ? "" : " (Last 6 Months)"}</h3>
          {growthData.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No sign-ups in this range.</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="signups" name="New Members" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4 flex flex-col items-center text-center gap-1">
        {icon}
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
