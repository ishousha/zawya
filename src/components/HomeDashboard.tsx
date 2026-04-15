import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Users, UserCheck, Clock } from "lucide-react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

function StatCard({ icon: Icon, label, value, onClick }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className="rounded-lg border border-border bg-card p-4 text-center transition-colors hover:bg-muted/50 disabled:hover:bg-card"
    >
      <Icon className="mx-auto mb-1.5 h-5 w-5 text-primary" />
      <p className="text-2xl font-bold text-foreground">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </button>
  );
}

function AdminDashboardSummary() {
  const navigate = useNavigate();

  const { data: activeEventsCount } = useQuery({
    queryKey: ["dashboard-active-events"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("events")
        .select("*", { count: "exact", head: true })
        .in("status", ["active", "full"])
        .eq("published", true)
        .gte("date_time", new Date().toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-users-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: memberCount } = useQuery({
    queryKey: ["dashboard-member-count"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .in("role", ["approved", "admin", "moderator"]);
      if (error) throw error;
      return count ?? 0;
    },
  });

  return (
    <div className="mb-6">
      <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Community Overview
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          icon={CalendarDays}
          label="Upcoming Events"
          value={activeEventsCount ?? "–"}
          onClick={() => navigate("/admin")}
        />
        <StatCard
          icon={Clock}
          label="Pending Approvals"
          value={pendingCount ?? "–"}
          onClick={() => navigate("/admin")}
        />
        <StatCard
          icon={Users}
          label="Members"
          value={memberCount ?? "–"}
        />
      </div>
    </div>
  );
}

function MemberDashboardSummary() {
  const { user } = useAuth();

  const { data: nextEvent } = useQuery({
    queryKey: ["dashboard-my-next-event", user?.id],
    staleTime: 60_000,
    enabled: !!user,
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, events(id, title, date_time, location)")
        .eq("user_id", user!.id)
        .eq("status", "attending")
        .not("events", "is", null);
      if (error) throw error;

      // Filter to future events and sort
      const future = (data ?? [])
        .filter((r: any) => r.events && r.events.date_time >= now)
        .sort((a: any, b: any) => a.events.date_time.localeCompare(b.events.date_time));

      return future[0]?.events ?? null;
    },
  });

  const { data: monthCount } = useQuery({
    queryKey: ["dashboard-my-month-count", user?.id],
    staleTime: 60_000,
    enabled: !!user,
    queryFn: async () => {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, events!inner(date_time)")
        .eq("user_id", user!.id)
        .eq("status", "attending")
        .gte("events.date_time", startOfMonth)
        .lte("events.date_time", endOfMonth);
      if (error) throw error;
      return data?.length ?? 0;
    },
  });

  const navigate = useNavigate();

  if (!nextEvent && !monthCount) return null;

  return (
    <div className="mb-6">
      <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        Your Schedule
      </h2>
      {nextEvent ? (
        <button
          onClick={() => navigate(`/events/${nextEvent.id}`)}
          className="w-full rounded-lg border border-primary/20 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10"
        >
          <p className="text-xs font-medium text-primary mb-1">Next Event</p>
          <p className="font-heading font-semibold text-foreground">{(nextEvent as any).title}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {format(new Date((nextEvent as any).date_time), "EEEE, MMM d · h:mm a")}
          </p>
          {(nextEvent as any).location && (
            <p className="text-xs text-muted-foreground mt-0.5">{(nextEvent as any).location}</p>
          )}
        </button>
      ) : (
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <UserCheck className="mx-auto mb-1.5 h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No upcoming RSVPs</p>
        </div>
      )}
      {(monthCount ?? 0) > 0 && (
        <p className="mt-2 text-xs text-muted-foreground text-center">
          You're attending <span className="font-semibold text-foreground">{monthCount}</span> event{monthCount !== 1 ? "s" : ""} this month
        </p>
      )}
    </div>
  );
}

export { AdminDashboardSummary, MemberDashboardSummary };
