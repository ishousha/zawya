import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { CalendarPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { generateQRHash } from "@/lib/qr-hash";

interface AdminRsvpActionProps {
  userId: string;
  userName: string | null;
  existingEventIds?: string[];
}

export default function AdminRsvpAction({ userId, userName, existingEventIds = [] }: AdminRsvpActionProps) {
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

  const availableEvents = events?.filter((e) => !existingEventIds.includes(e.id)) ?? [];

  const createRsvp = useMutation({
    mutationFn: async () => {
      if (!selectedEvent) throw new Error("Please select an event");
      const qrHash = generateQRHash(userId, selectedEvent);
      const { error } = await supabase.from("rsvps").insert({
        event_id: selectedEvent,
        user_id: userId,
        guests_count: 1,
        qr_hash: qrHash,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-all-rsvps"] });
      toast.success(`${userName || "User"} has been RSVP'd to the event`);
      setOpen(false);
      setSelectedEvent("");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create RSVP"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon" variant="outline" className="h-9 w-9" title="RSVP to event">
          <CalendarPlus className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>RSVP {userName || "User"} to an Event</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
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
      </DialogContent>
    </Dialog>
  );
}
