import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useCallback } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Search, Download, Mail, Pencil, ChevronDown, ArrowUpDown, CalendarIcon } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, UserCheck, Clock, UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { notifyUserApproval } from "@/lib/webhooks";
import { format } from "date-fns";
import AdminRsvpAction from "./AdminRsvpAction";
import EditUserModal from "./EditUserModal";
import InviteUserModal from "./InviteUserModal";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import UserAvatar from "@/components/UserAvatar";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

function logActivity(actorId: string, action: string, target: Profile, details?: Record<string, unknown>) {
  (supabase.from("admin_activity_log") as any).insert({
    actor_id: actorId, action,
    target_user_id: target.id, target_user_name: target.name, target_user_email: target.email,
    details: details ?? {},
  }).then(({ error }: any) => { if (error) console.warn("Activity log insert failed:", error); });
}

export default function UserManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<Profile | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFamilyId, setNewFamilyId] = useState("");
  const [newRole, setNewRole] = useState<"approved" | "guest">("approved");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [visibleCount, setVisibleCount] = useState(50);

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, role, family_id, family_name, whatsapp_number, is_mureed, avatar_url, created_at, notification_preferences, alternate_cell_number, date_of_birth, gender, onboarding_completed, terms_accepted, updated_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        if (a.role === "pending" && b.role !== "pending") return -1;
        if (a.role !== "pending" && b.role === "pending") return 1;
        return 0;
      });
    },
  });

  const { data: userRoles } = useQuery({
    queryKey: ["admin-user-roles"],
    staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesMap = useMemo(() => {
    const map: Record<string, AppRole[]> = {};
    userRoles?.forEach((r) => { if (!map[r.user_id]) map[r.user_id] = []; map[r.user_id].push(r.role); });
    return map;
  }, [userRoles]);

  const { data: families } = useQuery({
    queryKey: ["admin-families-lookup"],
    staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const familyMap = useMemo(() => {
    const map: Record<string, string> = {};
    families?.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [families]);

  const { data: allRsvps } = useQuery({
    queryKey: ["admin-all-rsvps"],
    staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("user_id, event_id, events:event_id(id, title)")
        .neq("status", "cancelled")
        .limit(1000);
      if (error) throw error;
      return data ?? [];
    },
  });

  const userRsvpMap = useMemo(() => {
    const map: Record<string, { event_id: string; title: string }[]> = {};
    allRsvps?.forEach((r: any) => {
      const uid = r.user_id;
      if (!map[uid]) map[uid] = [];
      const title = r.events?.title;
      if (title && !map[uid].some((e) => e.event_id === r.event_id)) map[uid].push({ event_id: r.event_id, title });
    });
    return map;
  }, [allRsvps]);

  const eventOptions = useMemo(() => {
    const seen = new Map<string, string>();
    allRsvps?.forEach((r: any) => { if (r.events?.title && !seen.has(r.event_id)) seen.set(r.event_id, r.events.title); });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  }, [allRsvps]);

  const { data: guestRequests, isLoading: loadingGuests } = useQuery({
    queryKey: ["admin-guest-requests"],
    staleTime: 5 * 60 * 1000, gcTime: 10 * 60 * 1000, refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*, events:event_id(title, date_time), profiles:requesting_user_id(name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role, email, name, previousRole }: { userId: string; role: AppRole; email?: string | null; name?: string | null; previousRole?: AppRole }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
      if (error) throw error;
      const { error: roleError } = await supabase.from("user_roles").upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (roleError) console.warn("user_roles upsert:", roleError);
      await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", role);
      notifyUserApproval(userId, role);
      if (email) {
        const templateMap: Record<string, string> = {
          approved: "user-approved",
          rejected: "user-rejected",
          suspended: "user-suspended",
        };
        // If reinstating from suspended → approved, use the reinstated template
        let templateName = templateMap[role];
        if (role === "approved" && previousRole === "suspended") {
          templateName = "user-reinstated";
        }
        if (templateName) {
          supabase.functions.invoke("send-transactional-email", {
            body: { templateName, recipientEmail: email, idempotencyKey: `${templateName}-${userId}-${Date.now()}`, templateData: { memberName: name || undefined } },
          }).catch((err) => console.warn("Failed to send role change email:", err));
        }
      }
      if (user) {
        logActivity(user.id, role === "suspended" ? "suspend_user" : "role_change", { id: userId, name, email } as Profile, { previous_role: previousRole, new_role: role });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("User role updated — member will be notified");
    },
    onError: () => toast.error("Failed to update user role"),
  });

  const createMember = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: { email: newEmail.trim(), name: newName.trim(), family_id: newFamilyId || undefined, role: newRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success(newRole === "guest" ? "Guest created!" : "Member created and auto-approved!");
      setAddOpen(false); setNewName(""); setNewEmail(""); setNewFamilyId(""); setNewRole("approved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create member"),
  });

  const updateGuestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase.from("guest_requests").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] }); toast.success("Guest request updated"); },
    onError: () => toast.error("Failed to update guest request"),
  });

  const deleteUser = useMutation({
    mutationFn: async ({ userId, name, email }: { userId: string; name?: string | null; email?: string | null }) => {
      if (user) logActivity(user.id, "delete_user", { id: userId, name, email } as Profile);
      const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: userId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-rsvps"] });
      toast.success("User permanently deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to delete user"),
  });

  // Bulk actions
  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const p = profiles?.find((pr) => pr.id === id);
        if (user) logActivity(user.id, "delete_user", { id, name: p?.name, email: p?.email } as Profile);
        const { data, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: id } });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      setSelectedIds(new Set());
      toast.success("Selected users deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Bulk delete failed"),
  });

  const bulkSetMureed = useMutation({
    mutationFn: async ({ ids, value }: { ids: string[]; value: boolean }) => {
      for (const id of ids) {
        await supabase.from("profiles").update({ is_mureed: value } as any).eq("id", id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      setSelectedIds(new Set());
      toast.success("Mureed status updated");
    },
    onError: () => toast.error("Failed to update Mureed status"),
  });

  const debouncedSearch = useDebounce(search, 300);

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    const now = new Date();
    const filtered = profiles.filter((p) => {
      const q = debouncedSearch.toLowerCase();
      const matchesSearch = !q || (p.name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q) || (p.whatsapp_number || "").includes(q) || ((p.family_id && familyMap[p.family_id]) || "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      const matchesEvent = eventFilter === "all" || (userRsvpMap[p.id]?.some((e) => e.event_id === eventFilter));
      // Date range filter
      let matchesDate = true;
      if (dateFilter !== "all") {
        const joinedAt = new Date(p.created_at);
        const diffDays = (now.getTime() - joinedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (dateFilter === "7d") matchesDate = diffDays <= 7;
        else if (dateFilter === "30d") matchesDate = diffDays <= 30;
        else if (dateFilter === "90d") matchesDate = diffDays <= 90;
        else if (dateFilter === "this-month") {
          matchesDate = joinedAt.getMonth() === now.getMonth() && joinedAt.getFullYear() === now.getFullYear();
        } else if (dateFilter === "this-year") {
          matchesDate = joinedAt.getFullYear() === now.getFullYear();
        }
      }
      return matchesSearch && matchesRole && matchesEvent && matchesDate;
    });
    return filtered.sort((a, b) => {
      if (a.role === "pending" && b.role !== "pending") return -1;
      if (a.role !== "pending" && b.role === "pending") return 1;
      const dateA = new Date(a.created_at).getTime();
      const dateB = new Date(b.created_at).getTime();
      return sortOrder === "newest" ? dateB - dateA : dateA - dateB;
    });
  }, [profiles, debouncedSearch, roleFilter, familyMap, eventFilter, userRsvpMap, sortOrder, dateFilter]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredProfiles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProfiles.map((p) => p.id)));
    }
  }, [filteredProfiles, selectedIds.size]);

  const [bulkDeleteConfirmOpen, setBulkDeleteConfirmOpen] = useState(false);

  if (loadingProfiles || loadingGuests) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6 py-4">
      <div>
        <div className="mb-3 flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Members ({filteredProfiles.length}{filteredProfiles.length !== (profiles?.length ?? 0) ? ` / ${profiles?.length}` : ""})
          </h3>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setInviteOpen(true)}>
              <Mail className="h-4 w-4" /> Invite
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><UserPlus className="h-4 w-4" /> Add Member</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add New Member</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-name">Name *</Label>
                    <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-email">Email *</Label>
                    <Input id="new-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="member@example.com" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-family">Family (optional)</Label>
                    <Select value={newFamilyId} onValueChange={setNewFamilyId}>
                      <SelectTrigger><SelectValue placeholder="No family" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No family</SelectItem>
                        {families?.map((f) => (<SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Role</Label>
                    <Select value={newRole} onValueChange={(v) => setNewRole(v as "approved" | "guest")}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="approved">Member (full access)</SelectItem>
                        <SelectItem value="guest">Guest (event-specific)</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">{newRole === "guest" ? "Guests can only see events they are RSVP'd to." : "Full members can see all active events."}</p>
                  </div>
                  <Button className="w-full" disabled={!newName.trim() || !newEmail.trim() || createMember.isPending} onClick={() => createMember.mutate()}>
                    {createMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {newRole === "guest" ? "Create Guest" : "Create & Auto-Approve"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick status filters */}
        {(() => {
          const pendingCount = profiles?.filter((p) => p.role === "pending").length ?? 0;
          const approvedCount = profiles?.filter((p) => p.role === "approved").length ?? 0;
          const suspendedCount = profiles?.filter((p) => p.role === "suspended").length ?? 0;
          const rejectedCount = profiles?.filter((p) => (p.role as string) === "rejected").length ?? 0;
          return (
            <div className="mb-3 flex overflow-x-auto gap-1.5 pb-2 scrollbar-hide">
              <Button size="sm" variant={roleFilter === "all" ? "default" : "outline"} className="h-7 text-xs whitespace-nowrap flex-shrink-0" onClick={() => setRoleFilter("all")}>All Users</Button>
              <Button size="sm" variant={roleFilter === "pending" ? "default" : "outline"} className={`h-7 text-xs gap-1 whitespace-nowrap flex-shrink-0 ${roleFilter !== "pending" && pendingCount > 0 ? "border-amber-400 text-amber-700 dark:text-amber-400" : ""}`} onClick={() => setRoleFilter("pending")}>
                Pending {pendingCount > 0 && <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[10px] font-bold text-white animate-pulse">{pendingCount}</span>}
              </Button>
              <Button size="sm" variant={roleFilter === "approved" ? "default" : "outline"} className="h-7 text-xs whitespace-nowrap flex-shrink-0" onClick={() => setRoleFilter("approved")}>Members ({approvedCount})</Button>
              <Button size="sm" variant={roleFilter === "rejected" ? "default" : "outline"} className="h-7 text-xs whitespace-nowrap flex-shrink-0" onClick={() => setRoleFilter("rejected")}>Rejected ({rejectedCount})</Button>
              <Button size="sm" variant={roleFilter === "suspended" ? "default" : "outline"} className="h-7 text-xs whitespace-nowrap flex-shrink-0" onClick={() => setRoleFilter("suspended")}>Suspended ({suspendedCount})</Button>
            </div>
          );
        })()}

        {/* Search & Filters */}
        <div className="mb-3 flex flex-col gap-2 md:flex-row">
          <div className="relative w-full md:flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search by name, email, phone, family…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Select value={eventFilter} onValueChange={setEventFilter}>
              <SelectTrigger className="w-full md:w-[160px] h-9"><SelectValue placeholder="All events" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {eventOptions.map((e) => (<SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>))}
              </SelectContent>
            </Select>
            <Select value={dateFilter} onValueChange={setDateFilter}>
              <SelectTrigger className="w-full md:w-[150px] h-9">
                <CalendarIcon className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue placeholder="Join date" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="7d">Last 7 days</SelectItem>
                <SelectItem value="30d">Last 30 days</SelectItem>
                <SelectItem value="90d">Last 90 days</SelectItem>
                <SelectItem value="this-month">This month</SelectItem>
                <SelectItem value="this-year">This year</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortOrder} onValueChange={(v) => setSortOrder(v as "newest" | "oldest")}>
              <SelectTrigger className="w-full md:w-[150px] h-9">
                <ArrowUpDown className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" className="h-9 gap-1.5 text-xs shrink-0" onClick={() => {
              const rows = filteredProfiles.map((p) => ({ Name: p.name || "", Email: p.email || "", Phone: p.phone || "", Role: p.role === "approved" ? "Member" : p.role, Family: (p.family_id && familyMap[p.family_id]) || "", Joined: format(new Date(p.created_at), "yyyy-MM-dd") }));
              downloadCsv(rows, zawyaFilename("Users")); toast.success(`Exported ${rows.length} users`);
            }}>
              <Download className="h-3.5 w-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* Bulk actions bar */}
        {selectedIds.size > 0 && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border bg-muted/50 p-2">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="gap-1 h-8 text-xs">
                  Bulk Actions <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setBulkDeleteConfirmOpen(true)} className="text-destructive">
                  <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetMureed.mutate({ ids: Array.from(selectedIds), value: true })}>
                  Set as Mureed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => bulkSetMureed.mutate({ ids: Array.from(selectedIds), value: false })}>
                  Remove Mureed Status
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setSelectedIds(new Set())}>Clear</Button>
          </div>
        )}

        {/* Select all checkbox */}
        <div className="mb-2 flex items-center gap-2 px-1">
          <Checkbox
            checked={filteredProfiles.length > 0 && selectedIds.size === filteredProfiles.length}
            onCheckedChange={toggleSelectAll}
            className="h-4 w-4"
          />
          <span className="text-xs text-muted-foreground">Select all</span>
        </div>

        <div className="space-y-2">
          {filteredProfiles.slice(0, visibleCount).map((p) => (
            <Card key={p.id} className={p.role === "pending" ? "border-accent" : ""}>
              <CardContent className="flex flex-col p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 flex-1 flex gap-3">
                  <div className="flex items-start gap-2">
                    <Checkbox
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleSelect(p.id)}
                      className="mt-3 h-4 w-4 shrink-0"
                    />
                    <UserAvatar name={p.name} avatarUrl={(p as any).avatar_url} className="h-10 w-10 shrink-0" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-card-foreground flex flex-wrap items-center gap-1.5">
                      <span className="truncate">{p.name || "Unnamed"}</span>
                      {p.role === "pending" && <Badge className="text-[10px] px-2 py-0.5 bg-amber-500 text-white border-amber-500 animate-pulse font-semibold">⏳ Awaiting Approval</Badge>}
                      {p.role === "approved" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Member</Badge>}
                      {p.role === "guest" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Guest</Badge>}
                      {p.role === "admin" && <Badge className="text-[10px] px-1.5 py-0">Admin</Badge>}
                      {p.role === "moderator" && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">Mod</Badge>}
                      {p.role === "suspended" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Suspended</Badge>}
                      {(p.role as string) === "rejected" && <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Rejected</Badge>}
                      {(p as any).is_mureed && <Badge className="text-[10px] px-1.5 py-0 bg-emerald-600 text-white border-emerald-600">Mureed</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.email}</p>
                    <p className="text-[11px] text-muted-foreground/70">Joined {format(new Date(p.created_at), "MMM d, yyyy")}</p>
                    {p.whatsapp_number && <p className="text-xs text-muted-foreground">📱 {p.whatsapp_number}</p>}
                    {p.family_id && familyMap[p.family_id] && <p className="text-xs text-muted-foreground">🏠 {familyMap[p.family_id]}</p>}
                    {p.family_name && !p.family_id && <p className="text-xs text-muted-foreground">Family: {p.family_name}</p>}
                    {rolesMap[p.id] && <p className="text-xs text-muted-foreground">Roles: {rolesMap[p.id].map(r => r === "approved" ? "Member" : r).join(", ")}</p>}
                    {userRsvpMap[p.id] && userRsvpMap[p.id].length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {userRsvpMap[p.id].map((e) => (<Badge key={e.event_id} variant="outline" className="text-[10px] px-1.5 py-0">{e.title}</Badge>))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 sm:mt-0 sm:ml-3 sm:flex-nowrap">
                  {p.role === "pending" && (
                    <>
                      <Button size="sm" className="h-9 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => updateRole.mutate({ userId: p.id, role: "approved" as AppRole, email: p.email, name: p.name, previousRole: p.role })} disabled={updateRole.isPending}>
                        <CheckCircle className="h-4 w-4" /> Approve
                      </Button>
                      <Button size="sm" variant="destructive" className="h-9 gap-1.5" onClick={() => updateRole.mutate({ userId: p.id, role: "rejected" as AppRole, email: p.email, name: p.name, previousRole: p.role })} disabled={updateRole.isPending}>
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    </>
                  )}
                  <AdminRsvpAction userId={p.id} userName={p.name} existingRsvps={userRsvpMap[p.id] ?? []} />
                  {(p.role === "approved" || p.role === "admin" || p.role === "moderator") && (
                    <div className="flex items-center gap-1.5" title="Toggle Mureed status">
                      <span className="text-xs text-muted-foreground">M</span>
                      <Switch
                        checked={(p as any).is_mureed ?? false}
                        onCheckedChange={async (checked) => {
                          const { error } = await supabase.from("profiles").update({ is_mureed: checked } as any).eq("id", p.id);
                          if (error) toast.error("Failed to update Mureed status");
                          else { queryClient.invalidateQueries({ queryKey: ["admin-profiles"] }); toast.success(checked ? "Marked as Mureed" : "Mureed status removed"); }
                        }}
                        className="scale-75"
                      />
                    </div>
                  )}
                  <Button variant="ghost" size="icon" className="h-9 w-9" title="Edit user" onClick={() => { setEditProfile(p); setEditOpen(true); }}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Select value={p.role} onValueChange={(val) => updateRole.mutate({ userId: p.id, role: val as AppRole, email: p.email, name: p.name, previousRole: p.role })}>
                    <SelectTrigger className="w-[120px] h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Member</SelectItem>
                      <SelectItem value="rejected">Rejected</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:bg-destructive/10"><Trash2 className="h-4 w-4" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete User Permanently?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently remove <span className="font-semibold">{p.name || p.email}</span> and all their data. This cannot be undone.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteUser.mutate({ userId: p.id, name: p.name, email: p.email })}>
                          {deleteUser.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Delete Forever
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredProfiles.length > visibleCount && (
            <div className="flex justify-center pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setVisibleCount((prev) => prev + 50)}
                className="gap-1.5"
              >
                Load more ({filteredProfiles.length - visibleCount} remaining)
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Guest Requests Section */}
      <div>
        <h3 className="mb-3 font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-foreground" /> Guest Requests ({guestRequests?.length ?? 0})
        </h3>
        {guestRequests && guestRequests.length > 0 ? (
          <div className="space-y-2">
            {guestRequests.map((gr) => (
              <Card key={gr.id} className={gr.status === "pending" ? "border-accent" : ""}>
                <CardContent className="flex flex-col p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-card-foreground">{gr.guest_name}</p>
                    {(gr as any).profiles?.name && <p className="text-xs text-muted-foreground">Requested by {(gr as any).profiles.name}</p>}
                    {(gr as any).events?.title && (
                      <p className="text-xs text-primary font-medium">
                        For: {(gr as any).events.title}
                        {(gr as any).events.date_time && ` — ${format(new Date((gr as any).events.date_time), "EEE, MMM d")}`}
                      </p>
                    )}
                    {gr.guest_phone && <p className="text-xs text-muted-foreground">{gr.guest_phone}</p>}
                  </div>
                  <div className="mt-3 flex items-center gap-2 sm:mt-0 sm:ml-3">
                    <Badge variant={gr.status === "pending" ? "outline" : gr.status === "approved" ? "default" : "destructive"} className="capitalize">{gr.status}</Badge>
                    {gr.status !== "approved" && (
                      <Button size="icon" className="h-10 w-10" onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "approved" })} disabled={updateGuestStatus.isPending} title="Approve"><CheckCircle className="h-5 w-5" /></Button>
                    )}
                    {gr.status !== "rejected" && (
                      <Button size="icon" variant="destructive" className="h-10 w-10" onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "rejected" })} disabled={updateGuestStatus.isPending} title="Reject"><XCircle className="h-5 w-5" /></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No guest requests yet.</p>
        )}
      </div>

      {/* Modals */}
      <EditUserModal profile={editProfile} open={editOpen} onOpenChange={setEditOpen} />
      <InviteUserModal open={inviteOpen} onOpenChange={setInviteOpen} />

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteConfirmOpen} onOpenChange={setBulkDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} Users?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete {selectedIds.size} users and all their data. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { bulkDelete.mutate(Array.from(selectedIds)); setBulkDeleteConfirmOpen(false); }}>
              {bulkDelete.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
