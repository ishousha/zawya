import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, UserMinus, UserCog, UserPlus, RefreshCw, Download, CalendarIcon, X } from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  actor_id: string;
  action: string;
  target_user_id: string | null;
  target_user_name: string | null;
  target_user_email: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof UserCog; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  role_change: { label: "Role Change", icon: UserCog, variant: "secondary" },
  suspend_user: { label: "Suspended", icon: ShieldAlert, variant: "destructive" },
  delete_user: { label: "Deleted", icon: UserMinus, variant: "destructive" },
  create_user: { label: "Created", icon: UserPlus, variant: "default" },
};

export default function AdminActivityLog() {
  const [actionFilter, setActionFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity-log"],
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as LogEntry[];
    },
  });

  // Fetch actor profiles for display names
  const actorIds = useMemo(() => [...new Set(logs?.map((l) => l.actor_id) ?? [])], [logs]);
  const { data: actorProfiles } = useQuery({
    queryKey: ["admin-activity-actors", actorIds],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", actorIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const actorMap = useMemo(() => {
    const map: Record<string, { name: string | null; email: string | null }> = {};
    actorProfiles?.forEach((p) => { map[p.id] = { name: p.name, email: p.email }; });
    return map;
  }, [actorProfiles]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    let result = logs;
    if (actionFilter !== "all") result = result.filter((l) => l.action === actionFilter);
    if (dateFrom) result = result.filter((l) => new Date(l.created_at) >= startOfDay(dateFrom));
    if (dateTo) result = result.filter((l) => new Date(l.created_at) <= endOfDay(dateTo));
    return result;
  }, [logs, actionFilter, dateFrom, dateTo]);

  const hasDateFilter = dateFrom || dateTo;
  const clearDates = () => { setDateFrom(undefined); setDateTo(undefined); };

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["Date", "Action", "Admin", "Target User", "Details"];
    const rows = filtered.map((log) => {
      const actor = actorMap[log.actor_id];
      const details = log.details as Record<string, unknown> | null;
      let detailStr = "";
      if (details && log.action === "role_change") detailStr = `${details.previous_role} → ${details.new_role}`;
      else if (details && log.action === "suspend_user") detailStr = `Previously: ${details.previous_role}`;
      return [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm"),
        ACTION_CONFIG[log.action]?.label ?? log.action,
        actor?.name || actor?.email || "Admin",
        log.target_user_name || log.target_user_email || "Unknown",
        detailStr,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `activity-log-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-foreground">
            Activity Log ({filtered.length})
          </h3>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="role_change">Role changes</SelectItem>
              <SelectItem value="suspend_user">Suspensions</SelectItem>
              <SelectItem value="delete_user">Deletions</SelectItem>
            </SelectContent>
          </Select>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-sm", !dateFrom && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateFrom ? format(dateFrom, "MMM d") : "From"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className={cn("h-9 gap-1.5 text-sm", !dateTo && "text-muted-foreground")}>
                <CalendarIcon className="h-3.5 w-3.5" />
                {dateTo ? format(dateTo, "MMM d") : "To"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {hasDateFilter && (
            <Button variant="ghost" size="sm" className="h-9 gap-1 text-xs text-muted-foreground" onClick={clearDates}>
              <X className="h-3.5 w-3.5" /> Clear dates
            </Button>
          )}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const config = ACTION_CONFIG[log.action] ?? { label: log.action, icon: UserCog, variant: "outline" as const };
            const Icon = config.icon;
            const actor = actorMap[log.actor_id];
            const details = log.details as Record<string, unknown> | null;

            return (
              <Card key={log.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={config.variant} className="text-[10px] px-1.5 py-0">
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), "MMM d, yyyy · h:mm a")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">
                      <span className="font-medium">{actor?.name || "Admin"}</span>
                      {" → "}
                      <span className="font-medium">{log.target_user_name || log.target_user_email || "Unknown user"}</span>
                    </p>
                    {details && log.action === "role_change" && (
                      <p className="text-xs text-muted-foreground">
                        {String(details.previous_role || "?")} → {String(details.new_role || "?")}
                      </p>
                    )}
                    {details && log.action === "suspend_user" && (
                      <p className="text-xs text-muted-foreground">
                        Previously: {String(details.previous_role || "?")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
