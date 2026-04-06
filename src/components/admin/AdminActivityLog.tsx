import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldAlert, UserMinus, UserCog, UserPlus, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { useState, useMemo } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity-log"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("admin_activity_log") as any)
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
    if (actionFilter === "all") return logs;
    return logs.filter((l) => l.action === actionFilter);
  }, [logs, actionFilter]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-base font-semibold text-foreground">
          Activity Log ({filtered.length})
        </h3>
        <div className="flex gap-2">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              <SelectItem value="role_change">Role changes</SelectItem>
              <SelectItem value="suspend_user">Suspensions</SelectItem>
              <SelectItem value="delete_user">Deletions</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
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
