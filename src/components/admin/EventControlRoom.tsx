import { useState, useMemo, useCallback } from "react";
import AdminGuestApprovals from "./AdminGuestApprovals";
import CheckinPoster from "./CheckinPoster";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Plus, Edit2, X, Users, ChevronDown, Copy, Trash2, Ban, RotateCcw, Download, Check, Printer, UserPlus, Mail, EyeOff } from "lucide-react";
import { downloadCsv, zawyaFilename } from "@/lib/csv-export";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import EventFormTabs from "./event-form/EventFormTabs";
import type { EventFormState } from "./event-form/types";
import type { SignUpItem } from "./event-form/ItemsTab";
import { useEventTypes } from "@/hooks/useEventTypes";
import HostDashboard from "@/components/HostDashboard";
import WalkInRsvpModal from "./WalkInRsvpModal";
import EventBroadcastModal from "./EventBroadcastModal";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

async function notifyRsvpMembers(eventId: string, eventTitle: string, eventDate: string, templateName: string) {
  try {
    const { data: rsvps } = await supabase
      .from("rsvps")
      .select("id, user_id")
      .eq("event_id", eventId);
    if (!rsvps || rsvps.length === 0) return;

    const userIds = [...new Set(rsvps.map(r => r.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, name")
      .in("id", userIds);
    if (!profiles) return;

    const formattedDate = format(new Date(eventDate), "PPPP p");

    for (const profile of profiles) {
      if (!profile.email) continue;
      await supabase.functions.invoke("send-transactional-email", {
        body: {
          templateName,
          recipientEmail: profile.email,
          idempotencyKey: `${templateName}-${eventId}-${profile.id}`,
          templateData: {
            eventTitle,
            eventDate: formattedDate,
            memberName: profile.name || undefined,
          },
        },
      });
    }
  } catch (error) {
    console.warn(`Failed to send ${templateName} notifications:`, error);
  }
}

export default function EventControlRoom() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [monitoringEventId, setMonitoringEventId] = useState<string | null>(null);
  const [duplicateForm, setDuplicateForm] = useState<{ form: EventFormState; items: SignUpItem[] } | null>(null);
  const [broadcastEvent, setBroadcastEvent] = useState<{ id: string; title: string } | null>(null);

  const { data: eventTypes } = useEventTypes();
  const getTypeName = (id: string) => eventTypes?.find((t) => t.id === id)?.name ?? "Event";

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*, rsvps(id, status)")
        .order("date_time", { ascending: true })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const getRsvpCount = (event: any) => {
    return event.rsvps?.filter((r: any) => r.status === "attending").length ?? 0;
  };

  const { data: allGuestRequests } = useQuery({
    queryKey: ["all-pending-guest-requests"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*, profiles:requesting_user_id(name, email), events:event_id(title, date_time, location, address, virtual_link, online_link)")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const pendingGuestCount = allGuestRequests?.length ?? 0;

  const handleDuplicate = async (event: EventRow) => {
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
      event_type_id: event.event_type_id,
      venue_id: event.venue_id ?? null,
      location: event.location ?? "",
      address: event.address ?? "",
      virtual_link: event.virtual_link ?? event.zoom_link ?? "",
      cover_photo_url: event.cover_photo_url ?? null,
      capacity: event.capacity?.toString() ?? "",
      waitlist_capacity: (event.waitlist_capacity ?? 0).toString(),
      is_hybrid: event.is_hybrid ?? false,
      has_potluck: event.has_potluck ?? true,
      ticket_fee: (event.ticket_fee ?? 0).toString(),
      payment_instructions: event.payment_instructions ?? "",
      online_link: event.online_link ?? "",
      status: "active",
      checkin_pin: event.checkin_pin ?? "",
      host_id: (event as any).host_id ?? null,
      mureeds_only: (event as any).mureeds_only ?? false,
      speaker_ids: [],
      notify_members: false,
      notify_attendees: false,
      etiquette_notes: (event as any).etiquette_notes ?? "",
      location_hint: (event as any).location_hint ?? "",
      age_group: (event as any).age_group ?? "All Ages",
      published: false,
      scheduled_publish_at: "",
      enable_virtual: !!(event.online_link),
      zoom_password: (event as any).zoom_password ?? "",
    };

    const copiedItems: SignUpItem[] = (items ?? []).map((item, i) => ({
      item_name: item.item_name,
      quantity_limit: item.quantity_limit,
      order_index: i,
    }));

    setDuplicateForm({ form, items: copiedItems });
  };

  const cancelMutation = useMutation({
    mutationFn: async (event: EventRow) => {
      const { error } = await supabase.from("events").update({ status: "cancelled" as const }).eq("id", event.id);
      if (error) throw error;
      notifyRsvpMembers(event.id, event.title, event.date_time, "event-cancelled");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event cancelled — members will be notified");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to cancel event")),
    onSettled: () => {},
  });

  const reactivateMutation = useMutation({
    mutationFn: async (event: EventRow) => {
      const { error } = await supabase.from("events").update({ status: "active" as const }).eq("id", event.id);
      if (error) throw error;
      notifyRsvpMembers(event.id, event.title, event.date_time, "event-reactivated");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event reactivated — members will be notified");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to reactivate event")),
    onSettled: () => {},
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const { data: rsvps, error: rsvpsFetchError } = await supabase.from("rsvps").select("id").eq("event_id", eventId);
      if (rsvpsFetchError) throw rsvpsFetchError;

      const rsvpIds = rsvps?.map((r) => r.id) ?? [];
      if (rsvpIds.length > 0) {
        const { error: selectionsError } = await supabase.from("rsvp_sign_up_selections").delete().in("rsvp_id", rsvpIds);
        if (selectionsError) throw selectionsError;
      }

      const { error: rsvpsDeleteError } = await supabase.from("rsvps").delete().eq("event_id", eventId);
      if (rsvpsDeleteError) throw rsvpsDeleteError;

      const { error: signUpItemsDeleteError } = await supabase.from("event_sign_up_items").delete().eq("event_id", eventId);
      if (signUpItemsDeleteError) throw signUpItemsDeleteError;

      const { error: guestRequestsDeleteError } = await supabase.from("guest_requests").delete().eq("event_id", eventId);
      if (guestRequestsDeleteError) throw guestRequestsDeleteError;

      const { error: potluckDeleteError } = await supabase.from("potluck_config").delete().eq("event_id", eventId);
      if (potluckDeleteError) throw potluckDeleteError;

      const { error } = await supabase.from("events").delete().eq("id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event permanently deleted");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to delete event")),
    onSettled: () => {},
  });

  const unpublishMutation = useMutation({
    mutationFn: async (event: EventRow) => {
      const { error } = await supabase
        .from("events")
        .update({ published: false, scheduled_publish_at: null } as any)
        .eq("id", event.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Event unpublished — hidden from members. Edit and republish when ready.");
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to unpublish event")),
  });

  const [statusFilter, setStatusFilter] = useState<"all" | "published" | "scheduled" | "draft">("all");

  const activeEvents = useMemo(() => {
    const nonCancelled = events?.filter(e => e.status !== "cancelled") ?? [];
    switch (statusFilter) {
      case "published":
        return nonCancelled.filter(e => (e as any).published);
      case "scheduled":
        return nonCancelled.filter(e => !(e as any).published && (e as any).scheduled_publish_at);
      case "draft":
        return nonCancelled.filter(e => !(e as any).published && !(e as any).scheduled_publish_at);
      default:
        return nonCancelled;
    }
  }, [events, statusFilter]);
  const cancelledEvents = events?.filter(e => e.status === "cancelled") ?? [];

  const filterCounts = useMemo(() => {
    const nonCancelled = events?.filter(e => e.status !== "cancelled") ?? [];
    return {
      all: nonCancelled.length,
      published: nonCancelled.filter(e => (e as any).published).length,
      scheduled: nonCancelled.filter(e => !(e as any).published && (e as any).scheduled_publish_at).length,
      draft: nonCancelled.filter(e => !(e as any).published && !(e as any).scheduled_publish_at).length,
    };
  }, [events]);

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

          {/* Pending Guest Approvals Section */}
          {pendingGuestCount > 0 && (
            <Collapsible defaultOpen>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-foreground hover:bg-accent/20 transition-colors">
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Pending Guest Approvals
                    <Badge variant="destructive" className="text-xs animate-pulse">
                      {pendingGuestCount}
                    </Badge>
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <PendingGuestApprovalsInline
                  requests={allGuestRequests ?? []}
                  onUpdated={() => {
                    queryClient.invalidateQueries({ queryKey: ["all-pending-guest-requests"] });
                    queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
                    queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
                  }}
                />
              </CollapsibleContent>
            </Collapsible>
          )}
          {/* Status filter tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {(["all", "published", "scheduled", "draft"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  statusFilter === f
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                <span className="ml-1 opacity-70">({filterCounts[f]})</span>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {activeEvents.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="min-w-0">
                      <p className="font-medium text-card-foreground text-base">{event.title}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {format(new Date(event.date_time), "PPP p")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge variant="secondary" className="text-xs capitalize">{getTypeName(event.event_type_id)}</Badge>
                        {(event as any).published ? (
                          <Badge className="text-xs bg-primary/20 text-primary hover:bg-primary/20">Published</Badge>
                        ) : (event as any).scheduled_publish_at ? (
                          <Badge variant="outline" className="text-xs border-blue-400 text-blue-600 bg-blue-50">
                            Scheduled
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 bg-amber-50">Draft</Badge>
                        )}
                        <Badge variant="default" className="text-xs capitalize">
                          {event.status}
                        </Badge>
                        {event.capacity && (() => {
                          const count = getRsvpCount(event);
                          const full = count >= event.capacity;
                          return (
                            <>
                              <Badge variant="outline" className={`text-xs ${full ? "border-destructive text-destructive" : ""}`}>
                                {count} / {event.capacity}
                              </Badge>
                              {full && (
                                <Badge variant="destructive" className="text-xs">Full</Badge>
                              )}
                            </>
                          );
                        })()}
                      </div>
                      {(event as any).last_published_at && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Last published {format(new Date((event as any).last_published_at), "MMM d, yyyy 'at' h:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-1 border-t border-border pt-2">
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => setMonitoringEventId(event.id)}>
                        <Users className="h-3.5 w-3.5" /> RSVPs
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => setEditing(event)}>
                        <Edit2 className="h-3.5 w-3.5" /> Edit
                      </Button>
                      {(event as any).published && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                              disabled={unpublishMutation.isPending}
                            >
                              <EyeOff className="h-3.5 w-3.5" /> Unpublish
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Unpublish "{event.title}"?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will hide the event from all members immediately. You can edit it and republish later without sending duplicate notifications.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => unpublishMutation.mutate(event)}
                                className="bg-amber-600 text-white hover:bg-amber-700"
                              >
                                <EyeOff className="mr-1.5 h-4 w-4" />
                                Unpublish
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => handleDuplicate(event)}>
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => setBroadcastEvent({ id: event.id, title: event.title })}>
                        <Mail className="h-3.5 w-3.5" /> Email
                      </Button>
                      <div className="ml-auto">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
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
                                  onClick={() => cancelMutation.mutate(event)}
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
                  </div>
                </CardContent>
              </Card>
            ))}
            {activeEvents.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No active events.</p>
            )}
          </div>

          {/* Cancelled / Past Events */}
          {cancelledEvents.length > 0 && (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex w-full items-center justify-between rounded-md border border-border bg-muted/50 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
                  <span className="flex items-center gap-1.5">
                    <Ban className="h-4 w-4" />
                    Cancelled Events ({cancelledEvents.length})
                  </span>
                  <ChevronDown className="h-4 w-4" />
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-2 pt-2">
                {cancelledEvents.map((event) => (
                  <Card key={event.id} className="border-destructive/30 opacity-75">
                    <CardContent className="p-4">
                      <div className="space-y-3">
                        <div className="min-w-0">
                          <p className="font-medium text-card-foreground text-base">{event.title}</p>
                          <p className="text-sm text-muted-foreground line-through mt-0.5">
                            {format(new Date(event.date_time), "PPP p")}
                          </p>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <Badge variant="secondary" className="text-xs capitalize">{getTypeName(event.event_type_id)}</Badge>
                            <Badge variant="destructive" className="text-xs capitalize">
                              {event.status}
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 border-t border-border pt-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 gap-1.5 text-xs text-primary hover:text-primary"
                            onClick={() => reactivateMutation.mutate(event)}
                            disabled={reactivateMutation.isPending}
                          >
                            <RotateCcw className="h-3.5 w-3.5" /> Reactivate
                          </Button>
                          <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => setMonitoringEventId(event.id)}>
                            <Users className="h-3.5 w-3.5" /> RSVPs
                          </Button>
                          <Button size="sm" variant="ghost" className="h-9 gap-1.5 text-xs" onClick={() => handleDuplicate(event)}>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </Button>
                          <div className="ml-auto">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete "{event.title}"?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Permanently delete this cancelled event and all its RSVPs. This cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Keep</AlertDialogCancel>
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
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CollapsibleContent>
            </Collapsible>
          )}
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

      {monitoringEventId && (() => {
        const monEvent = events?.find((e) => e.id === monitoringEventId);
        return (
          <RSVPMonitor
            eventId={monitoringEventId}
            eventTitle={monEvent?.title ?? "Event"}
            eventDate={monEvent?.date_time ?? ""}
            checkinPin={monEvent?.checkin_pin ?? ""}
            onClose={() => setMonitoringEventId(null)}
          />
        );
      })()}

      {broadcastEvent && (
        <EventBroadcastModal
          open={!!broadcastEvent}
          onOpenChange={(open) => !open && setBroadcastEvent(null)}
          eventId={broadcastEvent.id}
          eventTitle={broadcastEvent.title}
        />
      )}
    </div>
  );
}

function RSVPMonitor({ eventId, eventTitle, eventDate, checkinPin, onClose }: { eventId: string; eventTitle: string; eventDate: string; checkinPin: string; onClose: () => void }) {
  const [showPoster, setShowPoster] = useState(false);
  const [showWalkIn, setShowWalkIn] = useState(false);
  const [sendingGuestList, setSendingGuestList] = useState(false);

  const handleSendGuestList = async () => {
    setSendingGuestList(true);
    try {
      const { error } = await supabase.functions.invoke("send-guest-list-reminder", {
        body: { event_id: eventId },
      });
      if (error) throw error;
      toast.success("Guest list sent to host, admins & moderators");
    } catch (err) {
      console.error(err);
      toast.error("Failed to send guest list email");
    } finally {
      setSendingGuestList(false);
    }
  };
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
        .select("id, name, email, role")
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
            {r.profiles?.role === "guest" && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Guest</Badge>
            )}
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

  if (showPoster) {
    return (
      <CheckinPoster
        eventTitle={eventTitle}
        eventDate={eventDate}
        eventId={eventId}
        checkinPin={checkinPin}
        onClose={() => setShowPoster(false)}
      />
    );
  }

  return (
    <>
    <Card>
      <CardHeader className="pb-2">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-lg">Guest List & RSVPs</CardTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowWalkIn(true)}
            >
              <UserPlus className="h-3.5 w-3.5" /> Walk-In
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              onClick={handleSendGuestList}
              disabled={sendingGuestList}
            >
              {sendingGuestList ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Guest List
            </Button>
            {checkinPin && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowPoster(true)}
              >
                <Printer className="h-3.5 w-3.5" /> Poster
              </Button>
            )}
            {rsvps && rsvps.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => {
                  const rows = (rsvps ?? []).map((r: any) => {
                    const deps: { name: string }[] = r.attending_dependents ?? [];
                    return {
                      Name: r.profiles?.name || "",
                      Email: r.profiles?.email || "",
                      Role: r.profiles?.role || "",
                      "Plus Ones": r.guests_count - 1,
                      Dependents: deps.map((d) => d.name).join("; "),
                      Waitlisted: r.is_waitlisted ? "Yes" : "No",
                      "Checked In": r.checked_in ? "Yes" : "No",
                      "Potluck Item": r.specific_food_item || "",
                    };
                  });
                  downloadCsv(rows, zawyaFilename("GuestList", eventTitle));
                  toast.success(`Exported ${rows.length} RSVPs`);
                }}
              >
                <Download className="h-3.5 w-3.5" /> Export
              </Button>
            )}
            <Button size="icon" variant="ghost" className="h-10 w-10" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rsvps && rsvps.length > 0 ? (
          <div className="space-y-4">
            {/* Host Dashboard summary: headcount + potluck with names */}
            <HostDashboard eventId={eventId} />

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
    <WalkInRsvpModal eventId={eventId} open={showWalkIn} onOpenChange={setShowWalkIn} />
    </>
  );
}

function PendingGuestApprovalsInline({
  requests,
  onUpdated,
}: {
  requests: any[];
  onUpdated: () => void;
}) {
  const handleAction = async (gr: any, status: "approved" | "rejected") => {
    const { error } = await supabase
      .from("guest_requests")
      .update({ status })
      .eq("id", gr.id);
    if (error) {
      toast.error("Failed to update guest request");
      return;
    }

    // Send email on approval
    if (status === "approved" && gr.guest_email) {
      const evt = gr.events;
      const eventDate = evt?.date_time
        ? format(new Date(evt.date_time), "EEEE, MMMM d 'at' h:mm a")
        : "";
      const eventLink = evt?.online_link || evt?.virtual_link || "";
      const eventLocation = evt?.location
        ? `${evt.location}${evt.address ? ` — ${evt.address}` : ""}`
        : "";
      try {
        await supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "guest-approved",
            recipientEmail: gr.guest_email,
            templateData: {
              guestName: gr.guest_name || "Guest",
              eventTitle: evt?.title || "Event",
              eventDate,
              eventLocation,
              eventLink,
              requestedBy: gr.profiles?.name || "",
            },
          },
        });
      } catch (e) {
        console.warn("Failed to send guest approved email:", e);
      }
    }

    if (status === "rejected") {
      try {
        await supabase.functions.invoke("notify-guest-rejected", {
          body: {
            guest_name: gr.guest_name,
            event_title: gr.events?.title || "Event",
            requesting_user_name: gr.profiles?.name || "Member",
            requesting_user_email: gr.profiles?.email || "",
          },
        });
      } catch (e) {
        console.warn("Failed to trigger rejection webhook:", e);
      }
    }

    toast.success(`Guest ${status}`);
    onUpdated();
  };

  return (
    <div className="space-y-2">
      {requests.map((gr) => (
        <div key={gr.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-card-foreground">{gr.guest_name}</p>
            <p className="text-xs text-muted-foreground">
              Requested by {gr.profiles?.name || gr.profiles?.email || "Unknown"}
            </p>
            {gr.events?.title && (
              <p className="text-xs text-primary font-medium">
                For: {gr.events.title}
                {gr.events.date_time && ` — ${format(new Date(gr.events.date_time), "EEE, MMM d")}`}
              </p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-green-600 hover:bg-green-50"
              onClick={() => handleAction(gr, "approved")}
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive hover:bg-red-50"
              onClick={() => handleAction(gr, "rejected")}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
