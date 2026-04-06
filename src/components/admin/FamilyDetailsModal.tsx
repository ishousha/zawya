import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Users, Baby, CalendarCheck, Mail, Phone, User } from "lucide-react";
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
        .select("id, name, email, phone")
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
      return (data as any) ?? [];
    },
  });
}

export default function FamilyDetailsModal({
  familyId,
  familyName,
  open,
  onOpenChange,
}: FamilyDetailsModalProps) {
  const { data: members = [], isLoading: loadingMembers } = useFamilyMembers(familyId);
  const memberIds = members.map((m) => m.id);
  const { data: dependents = [], isLoading: loadingDeps } = useFamilyDependents(memberIds);
  const { data: rsvps = [], isLoading: loadingRsvps } = useFamilyRsvps(memberIds);

  const isLoading = loadingMembers || loadingDeps || loadingRsvps;

  // Deduplicate events for total count
  const uniqueEventIds = new Set(rsvps.map((r) => r.event_id));
  const totalEventsAttended = uniqueEventIds.size;

  // Checked-in count
  const checkedInCount = new Set(
    rsvps.filter((r) => r.checked_in).map((r) => r.event_id)
  ).size;

  // Recent 3 unique events
  const recentEvents: { title: string; date_time: string; event_id: string }[] = [];
  const seenEvents = new Set<string>();
  for (const r of rsvps) {
    if (seenEvents.has(r.event_id)) continue;
    seenEvents.add(r.event_id);
    if (r.events) {
      recentEvents.push({
        title: r.events.title,
        date_time: r.events.date_time,
        event_id: r.event_id,
      });
    }
    if (recentEvents.length >= 3) break;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {familyName}
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
                  <div
                    key={m.id}
                    className="flex flex-col gap-0.5 rounded-lg border p-3 text-sm"
                  >
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
                    {/* Dependents for this member */}
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
                ))}
              </div>
            </div>

            {/* Recent activity */}
            {recentEvents.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                  <CalendarCheck className="h-4 w-4" /> Recent Activity
                </h4>
                <div className="space-y-2">
                  {recentEvents.map((evt) => (
                    <div
                      key={evt.event_id}
                      className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    >
                      <span className="font-medium truncate">{evt.title}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                        {format(new Date(evt.date_time), "MMM d, yyyy")}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentEvents.length === 0 && (
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
