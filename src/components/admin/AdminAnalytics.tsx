import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Baby, Home, UserCheck } from "lucide-react";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
} from "recharts";
import { format, subMonths, startOfMonth } from "date-fns";

// ── Data hooks ──────────────────────────────────────────────

function useKpiData() {
  return useQuery({
    queryKey: ["analytics-kpi"],
    queryFn: async () => {
      const [profilesRes, familiesRes, dependentsRes] = await Promise.all([
        supabase.from("profiles").select("id, role, created_at"),
        supabase.from("families").select("id", { count: "exact", head: true }),
        supabase.from("dependents").select("id", { count: "exact", head: true }),
      ]);
      if (profilesRes.error) throw profilesRes.error;

      const profiles = profilesRes.data ?? [];
      const approved = profiles.filter((p) => p.role === "approved" || p.role === "admin").length;
      const pending = profiles.filter((p) => p.role === "pending").length;
      const totalFamilies = familiesRes.count ?? 0;
      const totalDependents = dependentsRes.count ?? 0;

      return { approved, pending, totalFamilies, totalDependents, profiles };
    },
  });
}

function useEventEngagement() {
  return useQuery({
    queryKey: ["analytics-event-engagement"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data: events, error } = await supabase
        .from("events")
        .select("id, title, date_time")
        .lt("date_time", now)
        .order("date_time", { ascending: false })
        .limit(5);
      if (error) throw error;
      if (!events || events.length === 0) return [];

      const eventIds = events.map((e) => e.id);
      const { data: rsvps, error: rsvpErr } = await supabase
        .from("rsvps")
        .select("event_id, checked_in")
        .in("event_id", eventIds);
      if (rsvpErr) throw rsvpErr;

      return events.reverse().map((evt) => {
        const evtRsvps = (rsvps ?? []).filter((r) => r.event_id === evt.id);
        return {
          name: evt.title.length > 18 ? evt.title.slice(0, 18) + "…" : evt.title,
          rsvps: evtRsvps.length,
          checkins: evtRsvps.filter((r) => r.checked_in).length,
        };
      });
    },
  });
}

// ── Component ───────────────────────────────────────────────

const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))"];

export default function AdminAnalytics() {
  const { data: kpi, isLoading: loadingKpi } = useKpiData();
  const { data: engagement = [], isLoading: loadingEngagement } = useEventEngagement();

  if (loadingKpi) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const { approved = 0, pending = 0, totalFamilies = 0, totalDependents = 0, profiles = [] } = kpi ?? {};

  // Pie data
  const pieData = [
    { name: "Adults", value: approved },
    { name: "Children", value: totalDependents },
  ].filter((d) => d.value > 0);

  // Growth data – last 6 months
  const growthData = (() => {
    const now = new Date();
    const months: { month: string; signups: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = startOfMonth(subMonths(now, i));
      const end = startOfMonth(subMonths(now, i - 1));
      const count = profiles.filter((p) => {
        const d = new Date(p.created_at);
        return d >= start && d < end;
      }).length;
      months.push({ month: format(start, "MMM yy"), signups: count });
    }
    return months;
  })();

  return (
    <div className="space-y-6 py-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KpiCard icon={<UserCheck className="h-5 w-5 text-primary" />} label="Active Members" value={approved} />
        <KpiCard icon={<Users className="h-5 w-5 text-amber-500" />} label="Pending Approvals" value={pending} />
        <KpiCard icon={<Home className="h-5 w-5 text-primary" />} label="Total Families" value={totalFamilies} />
        <KpiCard icon={<Baby className="h-5 w-5 text-primary" />} label="Total Dependents" value={totalDependents} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pie – Demographics */}
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

        {/* Bar – Event Engagement */}
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3">Event Engagement (Recent 5)</h3>
            {loadingEngagement ? (
              <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : engagement.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No past events yet.</p>
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
          <h3 className="text-sm font-semibold mb-3">Member Sign-up Growth (Last 6 Months)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={growthData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line type="monotone" dataKey="signups" name="New Members" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
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
