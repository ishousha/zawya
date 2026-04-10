import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loader2, Users, Baby, Home, UserCheck, CalendarIcon, X, Download, TrendingUp, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line, AreaChart, Area,
} from "recharts";
import { format, subMonths, startOfMonth, startOfDay, endOfDay, eachMonthOfInterval, isWithinInterval } from "date-fns";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

// ── Data hooks ──────────────────────────────────────────────

function useAllProfiles() {
  return useQuery({
    queryKey: ["analytics-profiles"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, role, is_mureed, created_at, family_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAllCounts() {
  return useQuery({
    queryKey: ["analytics-counts"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const [familiesRes, dependentsRes] = await Promise.all([
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("dependents").select("id, parent_id, created_at"),
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, status, capacity")
        .order("date_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useAllRsvps() {
  return useQuery({
    queryKey: ["analytics-rsvps"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, checked_in, created_at, guests_count, is_waitlisted, user_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

// ── Preset helpers ──────────────────────────────────────────

const PRESETS = [
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
  { label: "6mo", days: 180 },
  { label: "1yr", days: 365 },
] as const;

// ── Colors ──────────────────────────────────────────────────

const CHART_COLORS = {
  primary: "hsl(153, 40%, 28%)",
  accent: "hsl(43, 72%, 55%)",
  emerald: "hsl(153, 30%, 40%)",
  muted: "hsl(40, 20%, 75%)",
  warm: "hsl(20, 60%, 55%)",
  blue: "hsl(210, 50%, 50%)",
  rose: "hsl(350, 55%, 55%)",
};

const ROLE_COLORS: Record<string, string> = {
  approved: CHART_COLORS.primary,
  admin: CHART_COLORS.accent,
  pending: CHART_COLORS.warm,
  suspended: CHART_COLORS.rose,
  rejected: CHART_COLORS.muted,
  moderator: CHART_COLORS.blue,
  guest: CHART_COLORS.emerald,
};

// ── Custom tooltip ──────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-md">
      {label && <p className="text-xs font-medium text-foreground mb-1">{label}</p>}
      {payload.map((entry: any, i: number) => (
        <p key={i} className="text-xs" style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Component ───────────────────────────────────────────────

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

  const profilesSrc = hasRange ? filteredProfiles : profiles;

  const approved = useMemo(() => profilesSrc.filter((p) => p.role === "approved" || p.role === "admin").length, [profilesSrc]);
  const pending = useMemo(() => profilesSrc.filter((p) => p.role === "pending").length, [profilesSrc]);
  const totalMureeds = useMemo(() => profilesSrc.filter((p) => (p as any).is_mureed).length, [profilesSrc]);
  const totalGuests = useMemo(() => profilesSrc.filter((p) => p.role === "guest").length, [profilesSrc]);
  const totalRegistered = profilesSrc.length;

  const totalDependents = hasRange ? filteredDependents.length : (counts?.dependents ?? []).length;
  const totalFamilies = counts?.totalFamilies ?? 0;

  // Attendance rate: total checked-in / total RSVPs across all past events
  const attendanceRate = useMemo(() => {
    const pastEventIds = new Set(events.filter((e) => new Date(e.date_time) <= new Date()).map((e) => e.id));
    const pastRsvps = rsvps.filter((r) => pastEventIds.has(r.event_id));
    if (pastRsvps.length === 0) return 0;
    const checkedIn = pastRsvps.filter((r) => r.checked_in).length;
    return Math.round((checkedIn / pastRsvps.length) * 100);
  }, [events, rsvps]);

  // ── Role breakdown (donut) ────────────────────────────────

  const roleData = useMemo(() => {
    const src = hasRange ? filteredProfiles : profiles;
    const roleCounts: Record<string, number> = {};
    src.forEach((p) => {
      const r = p.role;
      roleCounts[r] = (roleCounts[r] || 0) + 1;
    });
    return Object.entries(roleCounts)
      .map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value, role: name }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [profiles, filteredProfiles, hasRange]);

  // ── Demographics pie (adults vs children) ─────────────────

  const pieData = [
    { name: "Adults", value: approved },
    { name: "Children", value: totalDependents },
  ].filter((d) => d.value > 0);

  // ── Event engagement bar chart ────────────────────────────

  const engagement = useMemo(() => {
    const now = new Date();
    const pastEvents = events
      .filter((e) => new Date(e.date_time) <= now)
      .filter((e) => inRange(e.date_time))
      .slice(0, 8)
      .reverse();

    return pastEvents.map((evt) => {
      const evtRsvps = rsvps.filter((r) => r.event_id === evt.id);
      return {
        name: evt.title.length > 14 ? evt.title.slice(0, 14) + "…" : evt.title,
        rsvps: evtRsvps.length,
        checkins: evtRsvps.filter((r) => r.checked_in).length,
      };
    });
  }, [events, rsvps, rangeFrom, rangeTo]);

  // ── Check-in rate per event ───────────────────────────────

  const checkinRates = useMemo(() => {
    return engagement.map((e) => ({
      name: e.name,
      rate: e.rsvps > 0 ? Math.round((e.checkins / e.rsvps) * 100) : 0,
    }));
  }, [engagement]);

  // ── Growth line chart ─────────────────────────────────────

  const growthData = useMemo(() => {
    const sourceProfiles = hasRange ? filteredProfiles : profiles;
    if (sourceProfiles.length === 0) return [];

    const now = new Date();
    let start: Date, end: Date;

    if (hasRange) {
      start = startOfMonth(rangeFrom!);
      end = rangeTo!;
    } else {
      start = startOfMonth(subMonths(now, 5));
      end = now;
    }

    const months = eachMonthOfInterval({ start, end });
    let cumulative = 0;
    return months.map((monthStart, i) => {
      const monthEnd = i < months.length - 1 ? months[i + 1] : new Date(end.getFullYear(), end.getMonth() + 1, 1);
      const count = sourceProfiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= monthStart && d < monthEnd;
      }).length;
      cumulative += count;
      return { month: format(monthStart, "MMM yy"), signups: count, total: cumulative };
    });
  }, [profiles, filteredProfiles, hasRange, rangeFrom, rangeTo]);

  // ── RSVP trend (monthly) ─────────────────────────────────

  const rsvpTrend = useMemo(() => {
    const now = new Date();
    let start: Date, end: Date;

    if (hasRange) {
      start = startOfMonth(rangeFrom!);
      end = rangeTo!;
    } else {
      start = startOfMonth(subMonths(now, 5));
      end = now;
    }

    const months = eachMonthOfInterval({ start, end });
    const filteredRsvps = hasRange ? rsvps.filter((r) => inRange(r.created_at)) : rsvps;

    return months.map((monthStart, i) => {
      const monthEnd = i < months.length - 1 ? months[i + 1] : new Date(end.getFullYear(), end.getMonth() + 1, 1);
      const count = filteredRsvps.filter((r) => {
        const d = new Date(r.created_at);
        return d >= monthStart && d < monthEnd;
      }).length;
      return { month: format(monthStart, "MMM yy"), rsvps: count };
    });
  }, [rsvps, hasRange, rangeFrom, rangeTo]);

  // ── Family size distribution ──────────────────────────────

  const familySizeData = useMemo(() => {
    const familyMembers: Record<string, number> = {};
    const src = hasRange ? filteredProfiles : profiles;
    src.forEach((p) => {
      if (p.family_id) {
        familyMembers[p.family_id] = (familyMembers[p.family_id] || 0) + 1;
      }
    });
    const sizeCounts: Record<number, number> = {};
    Object.values(familyMembers).forEach((size) => {
      sizeCounts[size] = (sizeCounts[size] || 0) + 1;
    });
    return Object.entries(sizeCounts)
      .map(([size, count]) => ({ size: `${size} member${Number(size) > 1 ? "s" : ""}`, count }))
      .sort((a, b) => parseInt(a.size) - parseInt(b.size));
  }, [profiles, filteredProfiles, hasRange]);

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
    <div className="space-y-5 py-4">
      {/* Date range filter */}
      <div className="flex flex-wrap items-center gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.days}
            size="sm"
            variant="outline"
            className="text-xs h-8 px-2.5"
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
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8">
              <CalendarIcon className="h-3.5 w-3.5" />
              Custom
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
              numberOfMonths={1}
              disabled={(date) => date > new Date()}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>

        {hasRange && (
          <Button size="sm" variant="ghost" className="gap-1 text-xs h-8" onClick={() => setDateRange(undefined)}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs h-8"
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
            <Download className="h-3.5 w-3.5" /> Export
          </Button>
          <span className="text-[11px] text-muted-foreground hidden sm:inline">{dateLabel}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <KpiCard icon={<Users className="h-5 w-5 text-primary" />} label="Total Registered" value={totalRegistered} />
        <KpiCard icon={<UserCheck className="h-5 w-5 text-primary" />} label="Active Members" value={approved} />
        <KpiCard icon={<TrendingUp className="h-5 w-5 text-emerald-600" />} label="Total Mureeds" value={totalMureeds} />
        <KpiCard icon={<Users className="h-5 w-5 text-accent" />} label="Total Guests" value={totalGuests} />
        <KpiCard icon={<Users className="h-5 w-5 text-amber-500" />} label="Pending" value={pending} />
        <KpiCard icon={<Home className="h-5 w-5 text-primary" />} label="Families" value={totalFamilies} />
        <KpiCard icon={<Baby className="h-5 w-5 text-accent" />} label="Dependents" value={totalDependents} />
        <KpiCard icon={<BarChart3 className="h-5 w-5 text-primary" />} label="Avg Attendance Rate" value={`${attendanceRate}%`} />
      </div>

      {/* Row 1: Role Breakdown + Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Member Roles">
          {roleData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={roleData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={2}
                  label={({ name, value }) => `${name} (${value})`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  {roleData.map((entry) => (
                    <Cell key={entry.role} fill={ROLE_COLORS[entry.role] || CHART_COLORS.muted} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Community Demographics">
          {pieData.length === 0 ? (
            <EmptyChart />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ strokeWidth: 1 }}
                >
                  <Cell fill={CHART_COLORS.primary} />
                  <Cell fill={CHART_COLORS.accent} />
                </Pie>
                <Tooltip content={<CustomTooltip />} />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 2: Event Engagement + Check-in Rate */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title={`Event Engagement (Recent ${engagement.length})`}>
          {engagement.length === 0 ? (
            <EmptyChart message="No past events" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={engagement} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px" }} />
                <Bar dataKey="rsvps" name="RSVPs" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} />
                <Bar dataKey="checkins" name="Check-ins" fill={CHART_COLORS.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title="Check-in Rate %">
          {checkinRates.length === 0 ? (
            <EmptyChart message="No data" />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={checkinRates} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} domain={[0, 100]} unit="%" />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="rate" name="Check-in %" fill={CHART_COLORS.emerald} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 3: Growth + RSVP Trend */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title={`Member Growth${hasRange ? "" : " (6 Months)"}`}>
          {growthData.length === 0 ? (
            <EmptyChart message="No sign-ups" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={growthData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="growthGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="signups" name="New Members" stroke={CHART_COLORS.primary} strokeWidth={2} fill="url(#growthGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>

        <ChartCard title={`RSVP Trend${hasRange ? "" : " (6 Months)"}`}>
          {rsvpTrend.length === 0 ? (
            <EmptyChart message="No RSVPs" />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={rsvpTrend} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                <defs>
                  <linearGradient id="rsvpGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={CHART_COLORS.accent} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={CHART_COLORS.accent} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="rsvps" name="RSVPs" stroke={CHART_COLORS.accent} strokeWidth={2} fill="url(#rsvpGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </ChartCard>
      </div>

      {/* Row 4: Family Size Distribution */}
      {familySizeData.length > 0 && (
        <ChartCard title="Family Size Distribution">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={familySizeData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
              <XAxis dataKey="size" tick={{ fontSize: 10 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" name="Families" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className="flex-shrink-0 rounded-lg bg-muted p-2">{icon}</div>
        <div className="min-w-0">
          <p className="text-xl font-bold leading-tight">{value}</p>
          <p className="text-[11px] text-muted-foreground truncate">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <h3 className="text-sm font-semibold mb-3">{title}</h3>
        {children}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ message = "No data yet" }: { message?: string }) {
  return <p className="text-sm text-muted-foreground text-center py-10">{message}</p>;
}
