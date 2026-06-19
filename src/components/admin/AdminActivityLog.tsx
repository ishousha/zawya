import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, ShieldAlert, UserMinus, UserCog, UserPlus, RefreshCw, Download,
  CalendarIcon, X, CheckCircle2, RotateCcw, Calendar as CalendarEv, MapPin,
  Tag, Mic, FileText, Megaphone, UserCheck, Users, Package, Send, Eye, EyeOff,
  Ban, PlayCircle, Trash2, Edit3, Search,
} from "lucide-react";
import { format, startOfDay, endOfDay } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

type GroupName = "Users" | "Events" | "Content" | "Guests" | "Check-ins";

type ActionConfig = {
  label: string;
  icon: typeof UserCog;
  variant: "default" | "secondary" | "destructive" | "outline";
  group: GroupName;
};

const ACTION_CONFIG: Record<string, ActionConfig> = {
  // Users
  role_change:           { label: "Role Change",       icon: UserCog,       variant: "secondary",   group: "Users" },
  suspend_user:          { label: "Suspended",         icon: ShieldAlert,   variant: "destructive", group: "Users" },
  delete_user:           { label: "Deleted User",      icon: UserMinus,     variant: "destructive", group: "Users" },
  create_user:           { label: "Created User",      icon: UserPlus,      variant: "default",     group: "Users" },

  // Events
  event_create:          { label: "Event Created",     icon: CalendarEv,    variant: "default",     group: "Events" },
  event_update:          { label: "Event Edited",      icon: Edit3,         variant: "secondary",   group: "Events" },
  event_publish:         { label: "Published",         icon: Eye,           variant: "default",     group: "Events" },
  event_unpublish:       { label: "Unpublished",       icon: EyeOff,        variant: "outline",     group: "Events" },
  event_cancel:          { label: "Cancelled",         icon: Ban,           variant: "destructive", group: "Events" },
  event_reactivate:      { label: "Reactivated",       icon: PlayCircle,    variant: "default",     group: "Events" },
  event_delete:          { label: "Event Deleted",     icon: Trash2,        variant: "destructive", group: "Events" },
  speaker_assign:        { label: "Speaker Added",     icon: Mic,           variant: "secondary",   group: "Events" },
  speaker_unassign:      { label: "Speaker Removed",   icon: Mic,           variant: "outline",     group: "Events" },
  signup_item_create:    { label: "Sign-up Added",     icon: Package,       variant: "secondary",   group: "Events" },
  signup_item_update:    { label: "Sign-up Edited",    icon: Package,       variant: "secondary",   group: "Events" },
  signup_item_delete:    { label: "Sign-up Removed",   icon: Package,       variant: "outline",     group: "Events" },

  // Content
  venue_create:          { label: "Venue Added",       icon: MapPin,        variant: "default",     group: "Content" },
  venue_update:          { label: "Venue Edited",      icon: MapPin,        variant: "secondary",   group: "Content" },
  venue_delete:          { label: "Venue Deleted",     icon: MapPin,        variant: "destructive", group: "Content" },
  event_type_create:     { label: "Event Type Added",  icon: Tag,           variant: "default",     group: "Content" },
  event_type_update:     { label: "Event Type Edited", icon: Tag,           variant: "secondary",   group: "Content" },
  event_type_delete:     { label: "Event Type Deleted",icon: Tag,           variant: "destructive", group: "Content" },
  speaker_create:        { label: "Speaker Added",     icon: Mic,           variant: "default",     group: "Content" },
  speaker_update:        { label: "Speaker Edited",    icon: Mic,           variant: "secondary",   group: "Content" },
  speaker_delete:        { label: "Speaker Deleted",   icon: Mic,           variant: "destructive", group: "Content" },
  resource_create:       { label: "Resource Added",    icon: FileText,      variant: "default",     group: "Content" },
  resource_update:       { label: "Resource Edited",   icon: FileText,      variant: "secondary",   group: "Content" },
  resource_delete:       { label: "Resource Deleted",  icon: FileText,      variant: "destructive", group: "Content" },
  announcement_create:   { label: "Announcement",      icon: Megaphone,     variant: "default",     group: "Content" },
  announcement_update:   { label: "Announcement Edit", icon: Megaphone,     variant: "secondary",   group: "Content" },
  announcement_delete:   { label: "Announcement Del.", icon: Megaphone,     variant: "destructive", group: "Content" },
  family_create:         { label: "Family Created",    icon: Users,         variant: "default",     group: "Content" },
  family_update:         { label: "Family Renamed",    icon: Users,         variant: "secondary",   group: "Content" },
  family_delete:         { label: "Family Deleted",    icon: Users,         variant: "destructive", group: "Content" },
  broadcast:             { label: "Broadcast Sent",    icon: Send,          variant: "default",     group: "Content" },

  // Guests
  guest_request_approve: { label: "Guest Approved",    icon: UserCheck,     variant: "default",     group: "Guests" },
  guest_request_reject:  { label: "Guest Rejected",    icon: UserMinus,     variant: "destructive", group: "Guests" },
  guest_request_delete:  { label: "Guest Req. Deleted",icon: Trash2,        variant: "outline",     group: "Guests" },

  // Check-ins
  checkin_rsvp:          { label: "Checked In",        icon: CheckCircle2,  variant: "default",     group: "Check-ins" },
  undo_checkin:          { label: "Check-in Undone",   icon: RotateCcw,     variant: "outline",     group: "Check-ins" },
};

const GROUP_ORDER: GroupName[] = ["Users", "Events", "Content", "Guests", "Check-ins"];

const FILTER_GROUPS: { group: GroupName; actions: string[] }[] = GROUP_ORDER.map((g) => ({ group: g, actions: [] }));
Object.entries(ACTION_CONFIG).forEach(([key, cfg]) => {
  const g = FILTER_GROUPS.find((f) => f.group === cfg.group);
  if (g) g.actions.push(key);
});

const EVENT_SCOPED_GROUPS: GroupName[] = ["Events", "Guests", "Check-ins"];

function formatVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "yes" : "no";
  if (typeof v === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      try { return format(new Date(v), "MMM d, yyyy h:mm a"); } catch { /* noop */ }
    }
    return v.length > 60 ? v.slice(0, 57) + "…" : v;
  }
  return String(v);
}

function renderChangedDetails(details: Record<string, unknown> | null): string[] {
  if (!details) return [];
  const lines: string[] = [];
  const changed = (details as any).changed as Record<string, { from: unknown; to: unknown }> | undefined;
  if (changed && typeof changed === "object") {
    for (const [field, diff] of Object.entries(changed)) {
      const label = field.replace(/_/g, " ");
      lines.push(`${label}: ${formatVal(diff?.from)} → ${formatVal(diff?.to)}`);
    }
  }
  if ((details as any).guest_name) lines.unshift(`Guest: ${(details as any).guest_name}`);
  if ((details as any).speaker_name) lines.unshift(`Speaker: ${(details as any).speaker_name}`);
  if ((details as any).item_name && !changed) lines.unshift(`Item: ${(details as any).item_name}`);
  return lines;
}

export default function AdminActivityLog() {
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | GroupName>("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [eventFilter, setEventFilter] = useState("all");
  const [actorFilter, setActorFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();

  const { data: logs, isLoading, refetch } = useQuery({
    queryKey: ["admin-activity-log"],
    staleTime: 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("admin_activity_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as LogEntry[];
    },
  });

  const actorIds = useMemo(() => [...new Set(logs?.map((l) => l.actor_id) ?? [])], [logs]);
  const { data: actorProfiles } = useQuery({
    queryKey: ["admin-activity-actors", actorIds],
    enabled: actorIds.length > 0,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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

  // Reset action filter if it no longer matches the category
  useEffect(() => {
    if (categoryFilter === "all" || actionFilter === "all") return;
    if (ACTION_CONFIG[actionFilter]?.group !== categoryFilter) setActionFilter("all");
  }, [categoryFilter, actionFilter]);

  // Build option lists
  const eventOptions = useMemo(() => {
    const map = new Map<string, string>();
    (logs ?? []).forEach((l) => {
      const grp = ACTION_CONFIG[l.action]?.group;
      if (!grp || !EVENT_SCOPED_GROUPS.includes(grp)) return;
      if (!l.target_user_id) return;
      const label = l.target_user_name || `Event ${l.target_user_id.slice(0, 8)}`;
      if (!map.has(l.target_user_id)) map.set(l.target_user_id, label);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [logs]);

  const actorOptions = useMemo(() => {
    const ids = new Set<string>();
    (logs ?? []).forEach((l) => { if (l.actor_id) ids.add(l.actor_id); });
    return Array.from(ids)
      .map((id) => ({
        id,
        label: actorMap[id]?.name || actorMap[id]?.email || `Admin ${id.slice(0, 8)}`,
      }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [logs, actorMap]);

  const targetOptions = useMemo(() => {
    const map = new Map<string, string>();
    (logs ?? []).forEach((l) => {
      const grp = ACTION_CONFIG[l.action]?.group;
      if (grp !== "Users") return;
      if (!l.target_user_id) return;
      const label = l.target_user_name || l.target_user_email || `User ${l.target_user_id.slice(0, 8)}`;
      if (!map.has(l.target_user_id)) map.set(l.target_user_id, label);
    });
    return Array.from(map.entries())
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [logs]);

  const filtered = useMemo(() => {
    if (!logs) return [];
    const q = search.trim().toLowerCase();
    return logs.filter((l) => {
      const cfg = ACTION_CONFIG[l.action];
      if (categoryFilter !== "all" && cfg?.group !== categoryFilter) return false;
      if (actionFilter !== "all" && l.action !== actionFilter) return false;
      if (eventFilter !== "all") {
        const grp = cfg?.group;
        if (!grp || !EVENT_SCOPED_GROUPS.includes(grp)) return false;
        if (l.target_user_id !== eventFilter) return false;
      }
      if (actorFilter !== "all" && l.actor_id !== actorFilter) return false;
      if (targetFilter !== "all") {
        if (cfg?.group !== "Users") return false;
        if (l.target_user_id !== targetFilter) return false;
      }
      if (dateFrom && new Date(l.created_at) < startOfDay(dateFrom)) return false;
      if (dateTo && new Date(l.created_at) > endOfDay(dateTo)) return false;
      if (q) {
        const actor = actorMap[l.actor_id];
        const hay = [
          cfg?.label ?? l.action,
          l.action,
          actor?.name, actor?.email,
          l.target_user_name, l.target_user_email,
          l.details ? JSON.stringify(l.details) : "",
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [logs, search, categoryFilter, actionFilter, eventFilter, actorFilter, targetFilter, dateFrom, dateTo, actorMap]);

  const hasAnyFilter =
    !!search || categoryFilter !== "all" || actionFilter !== "all" ||
    eventFilter !== "all" || actorFilter !== "all" || targetFilter !== "all" ||
    !!dateFrom || !!dateTo;

  const clearAll = () => {
    setSearch("");
    setCategoryFilter("all");
    setActionFilter("all");
    setEventFilter("all");
    setActorFilter("all");
    setTargetFilter("all");
    setDateFrom(undefined);
    setDateTo(undefined);
  };

  const exportCsv = () => {
    if (!filtered.length) return;
    const headers = ["Date", "Action", "Admin", "Target", "Details"];
    const rows = filtered.map((log) => {
      const actor = actorMap[log.actor_id];
      const detailStr = renderChangedDetails(log.details).join(" | ");
      return [
        format(new Date(log.created_at), "yyyy-MM-dd HH:mm"),
        ACTION_CONFIG[log.action]?.label ?? log.action,
        actor?.name || actor?.email || "Admin",
        log.target_user_name || log.target_user_email || "—",
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

  const actionsForCategory = categoryFilter === "all"
    ? FILTER_GROUPS
    : FILTER_GROUPS.filter((g) => g.group === categoryFilter);

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (search) activeChips.push({ key: "search", label: `Search: "${search}"`, clear: () => setSearch("") });
  if (categoryFilter !== "all") activeChips.push({ key: "cat", label: `Category: ${categoryFilter}`, clear: () => setCategoryFilter("all") });
  if (actionFilter !== "all") activeChips.push({ key: "act", label: `Action: ${ACTION_CONFIG[actionFilter]?.label ?? actionFilter}`, clear: () => setActionFilter("all") });
  if (eventFilter !== "all") {
    const ev = eventOptions.find((e) => e.id === eventFilter);
    activeChips.push({ key: "ev", label: `Event: ${ev?.label ?? "—"}`, clear: () => setEventFilter("all") });
  }
  if (actorFilter !== "all") {
    const a = actorOptions.find((o) => o.id === actorFilter);
    activeChips.push({ key: "actor", label: `Admin: ${a?.label ?? "—"}`, clear: () => setActorFilter("all") });
  }
  if (targetFilter !== "all") {
    const t = targetOptions.find((o) => o.id === targetFilter);
    activeChips.push({ key: "target", label: `User: ${t?.label ?? "—"}`, clear: () => setTargetFilter("all") });
  }
  if (dateFrom) activeChips.push({ key: "from", label: `From ${format(dateFrom, "MMM d, yyyy")}`, clear: () => setDateFrom(undefined) });
  if (dateTo) activeChips.push({ key: "to", label: `To ${format(dateTo, "MMM d, yyyy")}`, clear: () => setDateTo(undefined) });

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

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action, admin, target, or details…"
            className="h-9 pl-8"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as typeof categoryFilter)}>
            <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {GROUP_ORDER.map((g) => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {actionsForCategory.filter((g) => g.actions.length > 0).map((g) => (
                <SelectGroup key={g.group}>
                  <SelectLabel>{g.group}</SelectLabel>
                  {g.actions.map((a) => (
                    <SelectItem key={a} value={a}>{ACTION_CONFIG[a].label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>

          <Select value={eventFilter} onValueChange={setEventFilter} disabled={eventOptions.length === 0}>
            <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Event" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              {eventOptions.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actorFilter} onValueChange={setActorFilter} disabled={actorOptions.length === 0}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Admin" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All admins</SelectItem>
              {actorOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={targetFilter} onValueChange={setTargetFilter} disabled={targetOptions.length === 0}>
            <SelectTrigger className="w-[170px] h-9"><SelectValue placeholder="Target user" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users</SelectItem>
              {targetOptions.map((o) => (
                <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
              ))}
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
        </div>

        {hasAnyFilter && (
          <div className="flex flex-wrap items-center gap-1.5">
            {activeChips.map((chip) => (
              <Badge key={chip.key} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5 text-xs font-normal">
                {chip.label}
                <button
                  onClick={chip.clear}
                  className="ml-0.5 rounded-sm hover:bg-background/60 p-0.5"
                  aria-label={`Clear ${chip.label}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground" onClick={clearAll}>
              Clear all
            </Button>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map((log) => {
            const config = ACTION_CONFIG[log.action] ?? { label: log.action, icon: UserCog, variant: "outline" as const, group: "Content" as const };
            const Icon = config.icon;
            const actor = actorMap[log.actor_id];
            const detailLines = renderChangedDetails(log.details);

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
                    <p className="text-sm text-foreground break-words">
                      <span className="font-medium">{actor?.name || actor?.email || "Admin"}</span>
                      {log.target_user_name || log.target_user_email ? (
                        <>
                          {" → "}
                          <span className="font-medium">{log.target_user_name || log.target_user_email}</span>
                        </>
                      ) : null}
                    </p>
                    {log.details && log.action === "role_change" && (
                      <p className="text-xs text-muted-foreground">
                        {String((log.details as any).previous_role || "?")} → {String((log.details as any).new_role || "?")}
                      </p>
                    )}
                    {log.details && log.action === "suspend_user" && (
                      <p className="text-xs text-muted-foreground">
                        Previously: {String((log.details as any).previous_role || "?")}
                      </p>
                    )}
                    {log.details && (log.action === "checkin_rsvp" || log.action === "undo_checkin") && (log.details as any).event_title && (
                      <p className="text-xs text-muted-foreground">
                        Event: {String((log.details as any).event_title)}
                      </p>
                    )}
                    {detailLines.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-0.5 pt-0.5">
                        {detailLines.slice(0, 8).map((line, i) => (
                          <li key={i} className="break-words">{line}</li>
                        ))}
                        {detailLines.length > 8 && (
                          <li className="italic">+{detailLines.length - 8} more</li>
                        )}
                      </ul>
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
