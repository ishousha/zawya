import { useState } from "react";
import AdminGuestApprovals from "./AdminGuestApprovals";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Plus, Edit2, X, Users, ChevronDown, Copy, Trash2, Ban } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import EventFormTabs from "./event-form/EventFormTabs";
import type { EventFormState } from "./event-form/types";
import type { SignUpItem } from "./event-form/ItemsTab";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export default function EventControlRoom() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [monitoringEventId, setMonitoringEventId] = useState<string | null>(null);
  const [duplicateForm, setDuplicateForm] = useState<{ form: EventFormState; items: SignUpItem[] } | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const handleDuplicate = async (event: EventRow) => {
    // Fetch sign-up items for this event
    const { data: items } = await supabase
      .from("event_sign_up_items")
      .select("*")
      .eq("event_id", event.id)
      .order("order_index", { ascending: true });

    const form: EventFormState = {
      title: event.title + " (Copy)",
      description: event.description ?? "",
      date_time: "",
      end_date_time: "",
      type: event.type,
      location: event.location ?? "",
      address: event.address ?? "",
      virtual_link: event.virtual_link ?? event.zoom_link ?? "",
      cover_photo_url: event.cover_photo_url ?? null,
      capacity: event.capacity?.toString() ?? "",
      waitlist_capacity: (event.waitlist_capacity ?? 0).toString(),
      is_hybrid: event.is_hybrid ?? false,
      status: "active",
    };

    const copiedItems: SignUpItem[] = (items ?? []).map((item, i) => ({
      item_name: item.item_name,
      quantity_limit: item.quantity_limit,
      order_index: i,
    }));

    setDuplicateForm({ form, items: copiedItems });
  };

  const cancelMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase.from("events").update({ status: "cancelled" as const }).eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event cancelled");
    },
    onError: () => toast.error("Failed to cancel event"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      await supabase.from("rsvp_sign_up_selections").delete().in(
        "rsvp_id",
        (await supabase.from("rsvps").select("id").eq("event_id", eventId)).data?.map(r => r.id) ?? []
      );
      await supabase.from("rsvps").delete().eq("event_id", eventId);
      await supabase.from("event_sign_up_items").delete().eq("event_id", eventId);
      await supabase.from("guest_requests").delete().eq("event_id", eventId);
      await supabase.from("potluck_config").delete().eq("event_id", eventId);
      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success("Event permanently deleted");
    },
    onError: () => toast.error("Failed to delete event"),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const showList = !creating && !editing && !monitoringEventId && !duplicateForm;

  return (
    <div className="space-y-4 py-4">
      {showList && (
        <>
          <Button onClick={() => setCreating(true)} className="w-full gap-2 h-12">
            <Plus className="h-5 w-5" /> Create Event
          </Button>

          <div className="space-y-2">
            {events?.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-card-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.date_time), "PPP p")}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge variant="secondary" className="text-xs capitalize">{event.type}</Badge>
                        <Badge variant={event.status === "active" ? "default" : "destructive"} className="text-xs capitalize">
                          {event.status}
                        </Badge>
                        {event.capacity && (
                          <Badge variant="outline" className="text-xs">Cap: {event.capacity}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-2 flex gap-1">
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setMonitoringEventId(event.id)}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setEditing(event)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => handleDuplicate(event)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-10 w-10 text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove "{event.title}"?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Choose to cancel (keeps records) or permanently delete this event and all its RSVPs.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
                            <AlertDialogCancel>Keep Event</AlertDialogCancel>
                            {event.status !== "cancelled" && (
                              <AlertDialogAction
                                onClick={() => cancelMutation.mutate(event.id)}
                                className="bg-muted text-foreground hover:bg-muted/80"
                              >
                                <Ban className="mr-1.5 h-4 w-4" />
                                Cancel Event
                              </AlertDialogAction>
                            )}
                            <AlertDialogAction
                              onClick={() => deleteMutation.mutate(event.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              <Trash2 className="mr-1.5 h-4 w-4" />
                              Delete Permanently
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {creating && (
        <EventFormTabs onClose={() => setCreating(false)} />
      )}

      {editing && (
        <EventFormTabs event={editing} onClose={() => setEditing(null)} />
      )}

      {duplicateForm && (
        <EventFormTabs
          initialForm={duplicateForm.form}
          initialItems={duplicateForm.items}
          onClose={() => setDuplicateForm(null)}
        />
      )}

      {monitoringEventId && (
        <RSVPMonitor eventId={monitoringEventId} onClose={() => setMonitoringEventId(null)} />
      )}
    </div>
  );
}

function RSVPMonitor({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: rsvps, isLoading } = useQuery({
    queryKey: ["admin-rsvps", eventId],
    queryFn: async () => {
      const { data: rsvpData, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      if (!rsvpData || rsvpData.length === 0) return [];

      const userIds = [...new Set(rsvpData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);

      const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
      return rsvpData.map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null }));
    },
  });

  const attending = rsvps?.filter((r: any) => !r.is_waitlisted) ?? [];
  const waitlisted = rsvps?.filter((r: any) => r.is_waitlisted) ?? [];

  const renderRow = (r: any) => {
    const name = r.profiles?.name || r.profiles?.email || "Unknown";
    const kids = r.guests_count - 1;
    const deps: { name: string; age: number | null }[] = r.attending_dependents ?? [];
    const hasDeps = kids > 0 && deps.length > 0;

    return (
      <div key={r.id} className="rounded-md border border-border">
        <div className="flex items-center justify-between p-3">
          <div className="min-w-0 flex-1 flex items-center gap-2">
            <p className="truncate text-sm font-medium text-card-foreground">{name}</p>
            {kids > 0 && (
              hasDeps ? (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <button className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
                      👨‍👧‍👦 +{kids} <ChevronDown className="h-3 w-3" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="px-3 pb-2 pt-1">
                    <div className="space-y-1">
                      {deps.map((d, i) => (
                        <p key={i} className="text-xs text-muted-foreground">
                          {d.name}{d.age !== null ? ` (${d.age})` : ""}
                        </p>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              ) : (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  👨‍👧‍👦 +{kids}
                </span>
              )
            )}
          </div>
          <Badge variant={r.checked_in ? "default" : "outline"} className="text-xs shrink-0">
            {r.checked_in ? "✓ In" : "Not in"}
          </Badge>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">RSVP Monitor</CardTitle>
        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rsvps && rsvps.length > 0 ? (
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Attending ({attending.length})
              </p>
              {attending.length > 0 ? (
                <div className="space-y-2">{attending.map(renderRow)}</div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No confirmed attendees yet.</p>
              )}
            </div>

            {waitlisted.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                  Waitlisted ({waitlisted.length})
                </p>
                <div className="space-y-2">{waitlisted.map(renderRow)}</div>
              </div>
            )}

            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Guest Requests
              </p>
              <AdminGuestApprovals eventId={eventId} />
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Total: {attending.reduce((s: number, r: any) => s + r.guests_count, 0)} attending
              {waitlisted.length > 0 && ` · ${waitlisted.reduce((s: number, r: any) => s + r.guests_count, 0)} waitlisted`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No RSVPs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
