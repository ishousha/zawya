import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, CheckCircle, XCircle, Clock, Search } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function AllGuestApprovals() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: guestRequests, isLoading } = useQuery({
    queryKey: ["all-guest-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*, events:event_id(title, date_time, location, address, virtual_link, online_link, type), profiles:requesting_user_id(name, email)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ gr, status }: { gr: any; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", gr.id);
      if (error) throw error;

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
        } catch (emailErr) {
          console.error("Failed to send guest approved email:", emailErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
      toast.success("Guest request updated");
    },
    onError: () => toast.error("Failed to update guest request"),
  });

  const filtered = useMemo(() => {
    if (!guestRequests) return [];
    const q = search.toLowerCase();
    if (!q) return guestRequests;
    return guestRequests.filter((gr) =>
      gr.guest_name.toLowerCase().includes(q) ||
      (gr as any).profiles?.name?.toLowerCase().includes(q) ||
      (gr as any).profiles?.email?.toLowerCase().includes(q) ||
      (gr as any).events?.title?.toLowerCase().includes(q) ||
      gr.guest_phone?.includes(q)
    );
  }, [guestRequests, search]);

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
        Guest Requests ({filtered.length}{filtered.length !== (guestRequests?.length ?? 0) ? ` / ${guestRequests?.length}` : ""})
      </h3>
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by guest name, requester, event…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((gr) => (
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
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No guest requests yet.</p>
      )}
    </div>
  );
}
