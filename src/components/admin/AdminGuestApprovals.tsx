import { useEventGuestRequests, useUpdateGuestRequestStatus } from "@/hooks/useGuestRequests";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AdminGuestApprovals({ eventId }: { eventId: string }) {
  const { data: requests, isLoading } = useEventGuestRequests(eventId);
  const updateStatus = useUpdateGuestRequestStatus();

  // Fetch event details for email
  const { data: eventData } = useQuery({
    queryKey: ["event-detail-for-email", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("title, date_time, location, address, virtual_link, online_link, event_type_id")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const pending = requests?.filter((r: any) => r.status === "pending") ?? [];
  const resolved = requests?.filter((r: any) => r.status !== "pending") ?? [];

  const handleAction = async (r: any, status: "approved" | "rejected") => {
    const eventDate = eventData?.date_time
      ? format(new Date(eventData.date_time), "EEEE, MMMM d 'at' h:mm a")
      : "";
     const onlineLink = eventData?.online_link;
    const eventLink = onlineLink
      ? onlineLink
      : eventData?.virtual_link || "";
    const eventLocation = eventData?.location || "";
    const eventAddress = eventData?.address || "";
    const mapQuery = [eventData?.location, eventData?.address].filter(Boolean).join(", ");
    const mapUrl = mapQuery
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
      : "";

    try {
      await updateStatus.mutateAsync({
        id: r.id,
        status,
        guestEmail: (r as any).guest_email || undefined,
        guestName: r.guest_name,
        eventTitle: eventData?.title || "",
        eventDate,
        eventLocation,
        eventAddress,
        mapUrl,
        eventLink,
        requestedByName: r.profiles?.name || "",
        requestedByEmail: r.profiles?.email || "",
      });
      toast.success(`Guest ${status}.`);
    } catch {
      toast.error("Failed to update guest request.");
    }
  };


  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No guest requests for this event.</p>;
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
            Pending Approvals ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-card-foreground">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.profiles?.name || r.profiles?.email || "Unknown"}
                  </p>
                  {r.guest_phone && (
                    <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                  )}
                  {(r as any).member_note && (
                    <div className="mt-1.5 rounded-md border border-border bg-muted/30 p-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5">
                        Note from member
                      </p>
                      <p className="text-xs text-foreground whitespace-pre-wrap">{(r as any).member_note}</p>
                    </div>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-600 hover:bg-green-50"
                    disabled={updateStatus.isPending}
                    onClick={() => handleAction(r, "approved")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-red-50"
                    disabled={updateStatus.isPending}
                    onClick={() => handleAction(r, "rejected")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Resolved ({resolved.length})
          </p>
          <div className="space-y-2">
            {resolved.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-border p-3 opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-card-foreground">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.profiles?.name || r.profiles?.email || "Unknown"}
                  </p>
                </div>
                <Badge
                  variant={r.status === "approved" ? "default" : "destructive"}
                  className="text-xs capitalize"
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
