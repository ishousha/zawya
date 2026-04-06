import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, CheckCircle, XCircle, UserCheck, Clock, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { notifyUserApproval } from "@/lib/webhooks";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

export default function UserManagement() {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newFamilyId, setNewFamilyId] = useState("");
  const [newRole, setNewRole] = useState<"approved" | "guest">("approved");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
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
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  const rolesMap = useMemo(() => {
    const map: Record<string, AppRole[]> = {};
    userRoles?.forEach((r) => {
      if (!map[r.user_id]) map[r.user_id] = [];
      map[r.user_id].push(r.role);
    });
    return map;
  }, [userRoles]);

  const { data: families } = useQuery({
    queryKey: ["admin-families-lookup"],
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

  const { data: guestRequests, isLoading: loadingGuests } = useQuery({
    queryKey: ["admin-guest-requests"],
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
    mutationFn: async ({ userId, role, email, name }: { userId: string; role: AppRole; email?: string | null; name?: string | null }) => {
      // Update profiles.role
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;

      // Upsert user_roles record
      const { error: roleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: userId, role }, { onConflict: "user_id,role" });
      if (roleError) console.warn("user_roles upsert:", roleError);

      // If changing away from a role, delete old role entries that don't match
      await supabase.from("user_roles").delete().eq("user_id", userId).neq("role", role);

      notifyUserApproval(userId, role);

      if (email) {
        const templateName = role === "approved" ? "user-approved" : "user-rejected";
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName,
            recipientEmail: email,
            idempotencyKey: `${templateName}-${userId}-${Date.now()}`,
            templateData: { memberName: name || undefined },
          },
        }).catch((err) => console.warn("Failed to send role change email:", err));
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
        body: {
          email: newEmail.trim(),
          name: newName.trim(),
          family_id: newFamilyId || undefined,
          role: newRole,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success(newRole === "guest" ? "Guest created!" : "Member created and auto-approved!");
      setAddOpen(false);
      setNewName("");
      setNewEmail("");
      setNewFamilyId("");
      setNewRole("approved");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create member"),
  });

  const updateGuestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
      toast.success("Guest request updated");
    },
    onError: () => toast.error("Failed to update guest request"),
  });

  const filteredProfiles = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter((p) => {
      const q = search.toLowerCase();
      const matchesSearch =
        !q ||
        (p.name || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.whatsapp_number || "").includes(q) ||
        ((p.family_id && familyMap[p.family_id]) || "").toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || p.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [profiles, search, roleFilter, familyMap]);

  if (loadingProfiles || loadingGuests) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Users Section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
            <UserCheck className="h-4 w-4 text-primary" />
            Members ({filteredProfiles.length}{filteredProfiles.length !== (profiles?.length ?? 0) ? ` / ${profiles?.length}` : ""})
          </h3>
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <UserPlus className="h-4 w-4" />
                Add Member
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-2">
                  <Label htmlFor="new-name">Name *</Label>
                  <Input
                    id="new-name"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Full name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-email">Email *</Label>
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="member@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-family">Family (optional)</Label>
                  <Select value={newFamilyId} onValueChange={setNewFamilyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="No family" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No family</SelectItem>
                      {families?.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  className="w-full"
                  disabled={!newName.trim() || !newEmail.trim() || createMember.isPending}
                  onClick={() => createMember.mutate()}
                >
                  {createMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create & Auto-Approve
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        {/* Search & Filter */}
        <div className="mb-3 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, family…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-[130px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="moderator">Moderator</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          {filteredProfiles.map((p) => (
            <Card key={p.id} className={p.role === "pending" ? "border-accent" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-card-foreground">
                    {p.name || "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  {p.whatsapp_number && (
                    <p className="text-xs text-muted-foreground">📱 {p.whatsapp_number}</p>
                  )}
                  {p.family_id && familyMap[p.family_id] && (
                    <p className="text-xs text-muted-foreground">🏠 {familyMap[p.family_id]}</p>
                  )}
                  {p.family_name && !p.family_id && (
                    <p className="text-xs text-muted-foreground">Family: {p.family_name}</p>
                  )}
                  {rolesMap[p.id] && (
                    <p className="text-xs text-muted-foreground">
                      Roles: {rolesMap[p.id].join(", ")}
                    </p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <Select
                    value={p.role}
                    onValueChange={(val) =>
                      updateRole.mutate({
                        userId: p.id,
                        role: val as AppRole,
                        email: p.email,
                        name: p.name,
                      })
                    }
                  >
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="approved">Approved</SelectItem>
                      <SelectItem value="moderator">Moderator</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Guest Requests Section */}
      <div>
        <h3 className="mb-3 font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-foreground" />
          Guest Requests ({guestRequests?.length ?? 0})
        </h3>
        {guestRequests && guestRequests.length > 0 ? (
          <div className="space-y-2">
            {guestRequests.map((gr) => (
              <Card key={gr.id} className={gr.status === "pending" ? "border-accent" : ""}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-card-foreground">{gr.guest_name}</p>
                    {(gr as any).profiles?.name && (
                      <p className="text-xs text-muted-foreground">Requested by {(gr as any).profiles.name}</p>
                    )}
                    {(gr as any).events?.title && (
                      <p className="text-xs text-primary font-medium">
                        For: {(gr as any).events.title}
                        {(gr as any).events.date_time && ` — ${format(new Date((gr as any).events.date_time), "EEE, MMM d")}`}
                      </p>
                    )}
                    {gr.guest_phone && (
                      <p className="text-xs text-muted-foreground">{gr.guest_phone}</p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Badge
                      variant={gr.status === "pending" ? "outline" : gr.status === "approved" ? "default" : "destructive"}
                      className="capitalize"
                    >
                      {gr.status}
                    </Badge>
                    {gr.status !== "approved" && (
                      <Button
                        size="icon"
                        className="h-10 w-10"
                        onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "approved" })}
                        disabled={updateGuestStatus.isPending}
                        title="Approve"
                      >
                        <CheckCircle className="h-5 w-5" />
                      </Button>
                    )}
                    {gr.status !== "rejected" && (
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-10 w-10"
                        onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "rejected" })}
                        disabled={updateGuestStatus.isPending}
                        title="Reject"
                      >
                        <XCircle className="h-5 w-5" />
                      </Button>
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
    </div>
  );
}
