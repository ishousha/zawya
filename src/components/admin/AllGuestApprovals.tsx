import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, CheckCircle, XCircle, Clock, Search, ChevronDown, CalendarDays, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { buildGuestWhatsAppUrl } from "@/lib/share-event";
import { useAdminDeleteGuestRequest } from "@/hooks/useGuestRequests";

interface GroupedEvent {
  eventId: string;
  title: string;
  dateTime: string | null;
  requests: any[];
  pendingCount: number;
  memberCount: number;
}

export default function AllGuestApprovals() {
  const queryClient = useQueryClient();
  const deleteRequest = useAdminDeleteGuestRequest();
  const [search, setSearch] = useState("");
  const [openEventIds, setOpenEventIds] = useState<Record<string, boolean>>({});

  const { data: guestRequests, isLoading } = useQuery({
    queryKey: ["all-guest-requests"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*, events:event_id(title, date_time, location, address, maps_url, virtual_link, online_link, event_type_id, rsvps(id, status)), profiles:requesting_user_id(name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ gr, status }: { gr: any; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", gr.id);
      if (error) throw error;

      if (status === "approved" && gr.guest_email) {
        const evt = gr.events;
        const eventDate = evt?.date_time
          ? format(new Date(evt.date_time), "EEEE, MMMM d 'at' h:mm a")
          : "";
        const eventLink = evt?.online_link || evt?.virtual_link || "";
        const eventLocation = evt?.location || "";
        const eventAddress = evt?.address || "";
        const mapQuery = [evt?.location, evt?.address].filter(Boolean).join(", ");
        const mapUrl = mapQuery
          ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
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
                eventAddress,
                mapUrl,
                eventLink,
                requestedBy: gr.profiles?.name || "",
              },
            },
          });
        } catch (emailErr) {
          console.error("Failed to send guest approved email:", emailErr);
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
        } catch (webhookErr) {
          console.error("Failed to trigger rejection webhook:", webhookErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
      toast.success("Guest request updated");
    },
    onError: () => toast.error("Failed to update guest request"),
  });

  // Filter, then group by event
  const grouped = useMemo<GroupedEvent[]>(() => {
    if (!guestRequests) return [];
    const q = search.toLowerCase().trim();
    const filtered = q
      ? guestRequests.filter((gr) =>
          gr.guest_name.toLowerCase().includes(q) ||
          (gr as any).profiles?.name?.toLowerCase().includes(q) ||
          (gr as any).profiles?.email?.toLowerCase().includes(q) ||
          (gr as any).events?.title?.toLowerCase().includes(q) ||
          gr.guest_phone?.includes(q) ||
          (gr as any).member_note?.toLowerCase().includes(q)
        )
      : guestRequests;

    const byEvent = new Map<string, GroupedEvent>();
    for (const gr of filtered) {
      const eventId = (gr as any).event_id ?? "unknown";
      const evt = (gr as any).events;
      if (!byEvent.has(eventId)) {
        const rsvpsArr = Array.isArray(evt?.rsvps) ? evt.rsvps : [];
        const memberCount = rsvpsArr.filter((r: any) => r.status === "attending").length;
        byEvent.set(eventId, {
          eventId,
          title: evt?.title || "Unknown event",
          dateTime: evt?.date_time ?? null,
          requests: [],
          pendingCount: 0,
          memberCount,
        });
      }
      const bucket = byEvent.get(eventId)!;
      bucket.requests.push(gr);
      if (gr.status === "pending") bucket.pendingCount += 1;
    }

    // Sort requests within group: pending first, newest first
    for (const g of byEvent.values()) {
      g.requests.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }

    // Sort events: any pending first, then by upcoming date
    return Array.from(byEvent.values()).sort((a, b) => {
      if (a.pendingCount > 0 && b.pendingCount === 0) return -1;
      if (a.pendingCount === 0 && b.pendingCount > 0) return 1;
      const aT = a.dateTime ? new Date(a.dateTime).getTime() : Infinity;
      const bT = b.dateTime ? new Date(b.dateTime).getTime() : Infinity;
      return aT - bT;
    });
  }, [guestRequests, search]);

  const totalPending = grouped.reduce((s, g) => s + g.pendingCount, 0);
  const totalShown = grouped.reduce((s, g) => s + g.requests.length, 0);

  const isOpen = (eventId: string, pendingCount: number) => {
    if (eventId in openEventIds) return openEventIds[eventId];
    // Default: open when there's pending activity OR when filtering
    return pendingCount > 0 || search.trim().length > 0;
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
      <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-2">
        <Clock className="h-4 w-4 text-accent-foreground" />
        Guest Requests
        <span className="text-sm font-normal text-muted-foreground">
          ({grouped.length} event{grouped.length !== 1 ? "s" : ""} · {totalShown} request{totalShown !== 1 ? "s" : ""}
          {totalPending > 0 ? ` · ${totalPending} pending` : ""})
        </span>
      </h3>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by guest, requester, event…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground">No guest requests yet.</p>
      ) : (
        <div className="space-y-3">
          {grouped.map((g) => {
            const open = isOpen(g.eventId, g.pendingCount);
            return (
              <Collapsible
                key={g.eventId}
                open={open}
                onOpenChange={(v) => setOpenEventIds((prev) => ({ ...prev, [g.eventId]: v }))}
                className="rounded-lg border border-border bg-card"
              >
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-muted/40 rounded-lg"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-primary shrink-0" />
                        <p className="font-medium text-card-foreground truncate">{g.title}</p>
                      </div>
                      {g.dateTime && (
                        <p className="text-xs text-muted-foreground ml-6">
                          {format(new Date(g.dateTime), "EEE, MMM d, yyyy · h:mm a")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {g.pendingCount > 0 && (
                        <Badge variant="default" className="h-6 px-2 text-xs">
                          {g.pendingCount} pending
                        </Badge>
                      )}
                      <Badge variant="secondary" className="h-6 px-2 text-xs">
                        {g.requests.length} guest{g.requests.length !== 1 ? "s" : ""}
                      </Badge>
                      <Badge variant="outline" className="h-6 px-2 text-xs hidden sm:inline-flex">
                        {g.memberCount} member{g.memberCount !== 1 ? "s" : ""} RSVP'd
                      </Badge>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 px-3 pb-3">
                    {g.requests.map((gr) => (
                      <Card key={gr.id} className={gr.status === "pending" ? "border-accent" : ""}>
                        <CardContent className="flex items-center justify-between p-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-card-foreground">{gr.guest_name}</p>
                            {(gr as any).profiles?.name && (
                              <p className="text-xs text-muted-foreground">
                                Requested by {(gr as any).profiles.name}
                              </p>
                            )}
                            {gr.guest_phone && (
                              <p className="text-xs text-muted-foreground">{gr.guest_phone}</p>
                            )}
                            {(gr as any).member_note && (
                              <div className="mt-1.5 rounded-md border border-border bg-muted/30 p-2">
                                <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                                  Note from member
                                </p>
                                <p className="text-xs text-foreground whitespace-pre-wrap">{(gr as any).member_note}</p>
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex items-center gap-2">
                            <Badge
                              variant={gr.status === "pending" ? "outline" : gr.status === "approved" ? "default" : "destructive"}
                              className="capitalize"
                            >
                              {gr.status}
                            </Badge>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 text-green-600 hover:bg-green-50 hover:text-green-700"
                              title="Share event details on WhatsApp"
                              onClick={() => {
                                const evt = (gr as any).events;
                                const url = buildGuestWhatsAppUrl({
                                  guestName: gr.guest_name,
                                  guestPhone: gr.guest_phone,
                                  eventTitle: evt?.title || "our gathering",
                                  eventDateISO: evt?.date_time,
                                  location: evt?.location,
                                  address: evt?.address,
                                  mapsUrl: evt?.maps_url,
                                  onlineLink: evt?.online_link || evt?.virtual_link,
                                });
                                window.open(url, "_blank", "noopener");
                              }}
                            >
                              <MessageCircle className="h-5 w-5" />
                            </Button>
                            {gr.status !== "approved" && (
                              <Button
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => updateStatus.mutate({ gr, status: "approved" })}
                                disabled={updateStatus.isPending}
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
                                onClick={() => updateStatus.mutate({ gr, status: "rejected" })}
                                disabled={updateStatus.isPending}
                                title="Reject"
                              >
                                <XCircle className="h-5 w-5" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 text-destructive hover:bg-red-50"
                              title="Delete guest request"
                              disabled={deleteRequest.isPending}
                              onClick={async () => {
                                if (!window.confirm(`Delete guest request for ${gr.guest_name}? This cannot be undone.`)) return;
                                try {
                                  await deleteRequest.mutateAsync(gr.id);
                                  toast.success("Guest request deleted.");
                                } catch {
                                  toast.error("Failed to delete guest request.");
                                }
                              }}
                            >
                              <Trash2 className="h-5 w-5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}
