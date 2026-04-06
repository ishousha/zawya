import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, format } from "date-fns";
import { Bell, Check, CheckCheck, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const NOTIFICATION_TYPES = [
  { value: "all", label: "All" },
  { value: "rsvp", label: "RSVPs" },
  { value: "event", label: "Events" },
  { value: "guest", label: "Guest Requests" },
  { value: "family", label: "Family" },
  { value: "info", label: "General" },
] as const;

type FilterType = (typeof NOTIFICATION_TYPES)[number]["value"];

export default function NotificationsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<FilterType>("all");

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications-full", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  const filtered = useMemo(
    () => filter === "all" ? notifications : notifications.filter((n: any) => n.type === filter),
    [notifications, filter]
  );

  const unreadCount = notifications.filter((n: any) => !n.is_read).length;

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-full", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-full", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] });
    },
  });

  const typeIcon = (type: string) => {
    switch (type) {
      case "rsvp": return "📋";
      case "event": return "📅";
      case "guest": return "👤";
      case "family": return "👨‍👩‍👧‍👦";
      default: return "ℹ️";
    }
  };

  // Group notifications by date
  const grouped = useMemo(() => {
    const groups: Record<string, typeof filtered> = {};
    filtered.forEach((n: any) => {
      const day = format(new Date(n.created_at), "yyyy-MM-dd");
      const label = format(new Date(n.created_at), "EEEE, MMMM d, yyyy");
      if (!groups[label]) groups[label] = [];
      groups[label].push(n);
    });
    return groups;
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-2xl px-4 pt-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5 text-primary" />
            <h1 className="font-heading text-xl font-bold text-foreground">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary gap-1.5"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Mark all read
            </Button>
          )}
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-4 scrollbar-hide">
          {NOTIFICATION_TYPES.map(({ value, label }) => {
            const count = value === "all"
              ? notifications.length
              : notifications.filter((n: any) => n.type === value).length;
            return (
              <button
                key={value}
                onClick={() => setFilter(value)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors border",
                  filter === value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:bg-accent hover:text-foreground"
                )}
              >
                {label}
                {count > 0 && (
                  <span className={cn(
                    "text-[10px] rounded-full px-1.5 py-0.5 font-bold",
                    filter === value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              {filter === "all" ? "No notifications yet" : `No ${filter} notifications`}
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(grouped).map(([dateLabel, items]) => (
              <div key={dateLabel}>
                <p className="text-xs font-medium text-muted-foreground mb-2 px-1">{dateLabel}</p>
                <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                  {(items as any[]).map((n: any) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) markAsRead.mutate(n.id);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3.5 hover:bg-accent/50 transition-colors flex items-start gap-3",
                        !n.is_read && "bg-primary/5"
                      )}
                    >
                      <span className="text-lg mt-0.5 shrink-0">{typeIcon(n.type)}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{n.title}</p>
                          {!n.is_read && (
                            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                        <p className="text-[10px] text-muted-foreground/70 mt-1">
                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {!n.is_read && (
                        <Check className="h-4 w-4 text-muted-foreground/50 mt-1 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
