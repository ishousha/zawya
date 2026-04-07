import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Users, Baby, CalendarCheck, Mail, Phone, User, Pencil, Trash2, Check, X } from "lucide-react";
import UserAvatar from "@/components/UserAvatar";
import { format } from "date-fns";

interface FamilyDetailsModalProps {
  familyId: string;
  familyName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface MemberProfile {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
}

interface DependentRow {
  id: string;
  first_name: string;
  parent_id: string | null;
}

interface RsvpWithEvent {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  checked_in: boolean;
  events: { title: string; date_time: string } | null;
}

function useFamilyMembers(familyId: string) {
  return useQuery<MemberProfile[]>({
    queryKey: ["family-detail-members", familyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, avatar_url")
        .eq("family_id", familyId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useFamilyDependents(memberIds: string[]) {
  return useQuery<DependentRow[]>({
    queryKey: ["family-detail-dependents", memberIds],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("id, first_name, parent_id")
        .in("parent_id", memberIds);
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useFamilyRsvps(memberIds: string[]) {
  return useQuery<RsvpWithEvent[]>({
    queryKey: ["family-detail-rsvps", memberIds],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, event_id, user_id, created_at, checked_in, events(title, date_time)")
        .in("user_id", memberIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RsvpWithEvent[];
    },
  });
}

export default function FamilyDetailsModal({
  familyId,
  familyName,
  open,
  onOpenChange,
}: FamilyDetailsModalProps) {
  const queryClient = useQueryClient();
  const { data: members = [], isLoading: loadingMembers } = useFamilyMembers(familyId);
  const memberIds = members.map((m) => m.id);
  const { data: dependents = [], isLoading: loadingDeps } = useFamilyDependents(memberIds);
  const { data: rsvps = [], isLoading: loadingRsvps } = useFamilyRsvps(memberIds);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(familyName);

  const isLoading = loadingMembers || loadingDeps || loadingRsvps;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-families"] });
    queryClient.invalidateQueries({ queryKey: ["admin-profiles-for-families"] });
  };

  const renameMutation = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("families").update({ name }).eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family renamed");
      setIsEditing(false);
      invalidate();
    },
    onError: () => toast.error("Failed to rename family"),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // Unassign all members first
      const { error: unassignError } = await supabase
        .from("profiles")
        .update({ family_id: null })
        .eq("family_id", familyId);
      if (unassignError) throw unassignError;

      const { error } = await supabase.from("families").delete().eq("id", familyId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family deleted");
      invalidate();
      onOpenChange(false);
    },
    onError: () => toast.error("Failed to delete family"),
  });

  // Deduplicate events for total count
  const uniqueEventIds = new Set(rsvps.map((r) => r.event_id));
  const totalEventsAttended = uniqueEventIds.size;

  const checkedInCount = new Set(
    rsvps.filter((r) => r.checked_in).map((r) => r.event_id)
  ).size;

  const recentEvents: { title: string; date_time: string; event_id: string }[] = [];
  const seenEvents = new Set<string>();
  for (const r of rsvps) {
    if (seenEvents.has(r.event_id)) continue;
    seenEvents.add(r.event_id);
    if (r.events) {
      recentEvents.push({ title: r.events.title, date_time: r.events.date_time, event_id: r.event_id });
    }
    if (recentEvents.length >= 3) break;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 w-full">
            <Users className="h-5 w-5 text-primary shrink-0" />
            {isEditing ? (
              <div className="flex items-center gap-1.5 flex-1">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-8 text-base"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && editName.trim()) renameMutation.mutate(editName.trim());
                    if (e.key === "Escape") { setIsEditing(false); setEditName(familyName); }
                  }}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  disabled={!editName.trim() || renameMutation.isPending}
                  onClick={() => renameMutation.mutate(editName.trim())}
                >
                  {renameMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                </Button>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setIsEditing(false); setEditName(familyName); }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <>
                <span className="flex-1">{familyName}</span>
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditName(familyName); setIsEditing(true); }}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete {familyName}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will remove the family group and unassign all {members.length} member{members.length !== 1 ? "s" : ""}. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {deleteMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* Stats cards */}
            <div className="grid grid-cols-3 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold">{members.length}</p>
                  <p className="text-xs text-muted-foreground">Members</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Baby className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold">{dependents.length}</p>
                  <p className="text-xs text-muted-foreground">Dependents</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <CalendarCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
                  <p className="text-2xl font-bold">{totalEventsAttended}</p>
                  <p className="text-xs text-muted-foreground">Events RSVP'd</p>
                </CardContent>
              </Card>
            </div>

            {checkedInCount > 0 && (
              <p className="text-xs text-muted-foreground text-center">
                Checked in at <span className="font-medium">{checkedInCount}</span> event{checkedInCount !== 1 ? "s" : ""}
              </p>
            )}

            {/* Members list */}
            <div>
              <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                <User className="h-4 w-4" /> Family Members
              </h4>
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex gap-3 items-start rounded-lg border p-3 text-sm">
                    <UserAvatar name={m.name} avatarUrl={m.avatar_url} className="h-9 w-9 shrink-0" />
                    <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-medium">{m.name || "Unnamed"}</span>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {m.email && (
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> {m.email}
                        </span>
                      )}
                      {m.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3" /> {m.phone}
                        </span>
                      )}
                    </div>
                    {dependents.filter((d) => d.parent_id === m.id).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {dependents
                          .filter((d) => d.parent_id === m.id)
                          .map((d) => (
                            <Badge key={d.id} variant="secondary" className="text-xs">
                              <Baby className="h-3 w-3 mr-1" /> {d.first_name}
                            </Badge>
                          ))}
                      </div>
                    )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            {recentEvents.length > 0 ? (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <CalendarCheck className="h-4 w-4" /> Recent Activity
                </h4>
                <div className="space-y-2">
                  {recentEvents.map((evt) => (
                    <div key={evt.event_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                      <span className="font-medium truncate">{evt.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(evt.date_time), "MMM d, yyyy")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-2">
                No event activity yet.
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
