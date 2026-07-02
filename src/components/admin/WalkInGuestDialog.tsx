import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { capacityToastFromError, parseCapacityError } from "@/lib/rsvp-errors";

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Quick walk-in guest entry for the door / event admin screens.
 * Creates an auto-approved guest_request on the spot — no sponsoring member required.
 * If the event is at capacity, auto-expands capacity by 1 and retries.
 */
export default function WalkInGuestDialog({ eventId, open, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const reset = () => { setName(""); setPhone(""); };

  const addGuest = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!name.trim()) throw new Error("Guest name is required");

      const doInsert = async () => {
        const { error } = await supabase.from("guest_requests").insert({
          event_id: eventId,
          requesting_user_id: user.id,
          guest_name: name.trim(),
          guest_phone: phone.trim() || null,
          guest_email: "",
          status: "approved",
        });
        if (error) throw error;
      };

      let expandedBy = 0;
      try {
        await doInsert();
      } catch (err) {
        const info = parseCapacityError((err as Error)?.message);
        if (!info || Number.isNaN(info.attempted)) throw err;
        const shortfall = Math.max(1, info.attempted - info.remaining);
        const { error: expErr } = await supabase.rpc("admin_expand_event_capacity" as any, {
          _event_id: eventId,
          _extra_seats: shortfall,
          _kind: "attending",
        });
        if (expErr) throw expErr;
        expandedBy = shortfall;
        await doInsert();
      }
      return { expandedBy };
    },
    onSuccess: (result) => {
      const suffix = result?.expandedBy && result.expandedBy > 0
        ? ` · Capacity expanded by ${result.expandedBy}`
        : "";
      toast.success(`${name.trim()} added as walk-in guest${suffix}`);
      queryClient.invalidateQueries({ queryKey: ["event-guest-requests", eventId] });
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
      queryClient.invalidateQueries({ queryKey: ["rsvp-counts", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-capacity", eventId] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => {
      const cap = capacityToastFromError(err);
      if (cap) toast.error(cap.title, { description: cap.description });
      else toast.error((err as Error).message || "Failed to add guest");
    },
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <UserPlus className="h-5 w-5 text-primary" /> Add Walk-In Guest
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="walkin-guest-name">Guest Name</Label>
            <Input
              id="walkin-guest-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="walkin-guest-phone">Phone (optional)</Label>
            <Input
              id="walkin-guest-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 555 123 4567"
              inputMode="tel"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Guest will be auto-approved. If the event is full, capacity will expand by 1.
          </p>
          <Button
            onClick={() => addGuest.mutate()}
            disabled={!name.trim() || addGuest.isPending}
            className="w-full h-11 gap-2"
          >
            {addGuest.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Add Guest
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
