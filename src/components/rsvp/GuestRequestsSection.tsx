import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMyGuestRequests, useCreateGuestRequest } from "@/hooks/useGuestRequests";
import { toast } from "sonner";
import { Loader2, UserPlus, Phone, User } from "lucide-react";

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

export default function GuestRequestsSection({ eventId }: { eventId: string }) {
  const { data: guests, isLoading } = useMyGuestRequests(eventId);
  const createGuest = useCreateGuestRequest(eventId);
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");

  const handleSubmit = async () => {
    if (!guestName.trim() || !guestPhone.trim()) {
      toast.error("Please fill in both fields.");
      return;
    }
    try {
      await createGuest.mutateAsync({
        guest_name: guestName.trim(),
        guest_phone: guestPhone.trim(),
      });
      toast.success("Guest request submitted for admin approval.");
      setGuestName("");
      setGuestPhone("");
      setShowForm(false);
    } catch {
      toast.error("Failed to submit guest request.");
    }
  };

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium">My Guests</Label>

      {isLoading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      ) : guests && guests.length > 0 ? (
        <div className="space-y-2">
          {guests.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{g.guest_name}</p>
                {g.guest_phone && (
                  <p className="text-xs text-muted-foreground">{g.guest_phone}</p>
                )}
              </div>
              <Badge variant={statusVariant[g.status] || "secondary"} className="text-xs capitalize">
                {g.status}
              </Badge>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground italic">No guest requests yet.</p>
      )}

      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setShowForm(true)}
        >
          <UserPlus className="h-3.5 w-3.5" />
          Request a Guest
        </Button>
      ) : (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
          <div>
            <Label className="mb-1 block text-xs font-medium">
              <User className="mr-1 inline h-3 w-3" />
              Guest Name
            </Label>
            <Input
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Full name"
              className="h-9"
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium">
              <Phone className="mr-1 inline h-3 w-3" />
              Guest Phone
            </Label>
            <Input
              value={guestPhone}
              onChange={(e) => setGuestPhone(e.target.value)}
              placeholder="+971 XX XXX XXXX"
              className="h-9"
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={createGuest.isPending} className="flex-1">
              {createGuest.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setShowForm(false)} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
