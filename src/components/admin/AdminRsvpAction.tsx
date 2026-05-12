import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarPlus, Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";

interface RsvpEvent {
  event_id: string;
  title: string;
}

interface AdminRsvpActionProps {
  userId: string;
  userName: string | null;
  existingRsvps?: RsvpEvent[];
}

export default function AdminRsvpAction({ userId, userName, existingRsvps = [] }: AdminRsvpActionProps) {
  const [open, setOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState("");
  const queryClient = useQueryClient();

  const { data: events } = useQuery({
    queryKey: ["admin-active-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time")
        .in("status", ["active", "full"])
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const existingEventIds = existingRsvps.map((r) => r.event_id);
  const availableEvents = events?.filter((e) => !existingEventIds.includes(e.id)) ?? [];

  const invalidateRsvps = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-all-rsvps"] });
  };

  const createRsvp = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Please select an event");
      const { error } = await supabase.from("rsvps").insert({
        event_id: selectedEvent,
        user_id: userId,
        guests_count: 1,
        status: "attending",
        is_waitlisted: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRsvps();
      toast.success(`${userName || "User"} has been RSVP'd to the event`);
      setSelectedEvent("");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create RSVP"),
  });

  const removeRsvp = useMutation({
    mutationFn: async (eventId: string) => {
      const { error } = await supabase
        .from("rsvps")
        .delete()
        .eq("user_id", userId)
        .eq("event_id", eventId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateRsvps();
      toast.success("RSVP removed");
    },
    onError: () => toast.error("Failed to remove RSVP"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9" title="Manage RSVPs">
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manage RSVPs — {userName || "User"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Existing RSVPs */}
          {existingRsvps.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Current RSVPs</p>
              <div className="space-y-1.5">
                {existingRsvps.map((r) => (
                  <div key={r.event_id} className="flex items-center justify-between rounded-md border px-3 py-2">
                    <Badge variant="outline" className="text-xs">{r.title}</Badge>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeRsvp.mutate(r.event_id)}
                      disabled={removeRsvp.isPending}
                      title="Remove RSVP"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add new RSVP */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-foreground">Add RSVP</p>
            <Select value={selectedEvent} onValueChange={setSelectedEvent}>
              <SelectTrigger>
                <SelectValue placeholder="Select an event…" />
              </SelectTrigger>
              <SelectContent>
                {availableEvents.length === 0 ? (
                  <SelectItem value="__none" disabled>No available events</SelectItem>
                ) : (
                  availableEvents.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedEvent || createRsvp.isPending}
              onClick={() => createRsvp.mutate()}
            >
              {createRsvp.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm RSVP
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
