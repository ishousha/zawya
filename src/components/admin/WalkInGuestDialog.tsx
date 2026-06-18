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

interface Props {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Quick walk-in guest entry for the door / event admin screens.
 * Creates an auto-approved guest_request on the spot — no sponsoring member required.
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
      const { error } = await supabase.from("guest_requests").insert({
        event_id: eventId,
        requesting_user_id: user.id,
        guest_name: name.trim(),
        guest_phone: phone.trim() || null,
        guest_email: "",
        status: "approved",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`${name.trim()} added as walk-in guest`);
      queryClient.invalidateQueries({ queryKey: ["event-guest-requests", eventId] });
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
      reset();
      onOpenChange(false);
    },
    onError: (err) => toast.error((err as Error).message || "Failed to add guest"),
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
            Guest will be auto-approved for this event.
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
