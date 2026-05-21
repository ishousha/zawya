import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMyGuestRequests, useCreateGuestRequest } from "@/hooks/useGuestRequests";
import { toast } from "sonner";
import { Loader2, UserPlus, Phone, User, Mail, Info, Share2, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  pending: "secondary",
  approved: "default",
  rejected: "destructive",
};

interface GuestRequestsSectionProps {
  eventId: string;
  event?: Event;
}

export default function GuestRequestsSection({ eventId, event }: GuestRequestsSectionProps) {
  const { data: guests, isLoading } = useMyGuestRequests(eventId);
  const createGuest = useCreateGuestRequest(eventId);
  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [memberNote, setMemberNote] = useState("");
  const NOTE_MAX = 300;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async () => {
    if (!guestName.trim()) {
      toast.error("Please enter the guest's name.");
      return;
    }
    if (!guestEmail.trim() || !isValidEmail(guestEmail.trim())) {
      toast.error("Please enter a valid email address.");
      return;
    }
    try {
      await createGuest.mutateAsync({
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim() || undefined,
        member_note: memberNote.trim() || undefined,
      });
      toast.success("Guest request submitted for admin approval.");
      setGuestName("");
      setGuestEmail("");
      setGuestPhone("");
      setMemberNote("");
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
          {guests.map((g) => {
            const isApproved = g.status === "approved";

            const buildShareMessage = () => {
              if (!event) return "";
              const date = format(new Date(event.date_time), "EEEE, MMMM d 'at' h:mm a");
              const locationPart = event.location
                  ? `Location: ${event.location}${event.address ? ` — ${event.address}` : ""}`
                  : "Details will be shared closer to the event.";
              return `Assalamu Alaikum ${g.guest_name}! Great news — your guest request for *${event.title}* on ${date} has been approved! 🎉\n\n${locationPart}\n\nLooking forward to seeing you there inshaAllah!`;
            };

            const handleShare = async () => {
              const message = buildShareMessage();
              if (!message) {
                toast.error("Event details unavailable.");
                return;
              }
              if (navigator.share) {
                try {
                  await navigator.share({ text: message });
                } catch (err: any) {
                  if (err?.name !== "AbortError") {
                    toast.error("Sharing failed.");
                  }
                }
              } else {
                const phone = g.guest_phone?.replace(/\D/g, "") || "";
                const waUrl = phone
                  ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
                  : `https://wa.me/?text=${encodeURIComponent(message)}`;
                window.open(waUrl, "_blank");
              }
            };

            return (
              <div
                key={g.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{g.guest_name}</p>
                    {(g as any).guest_email && (
                      <p className="text-xs text-muted-foreground">{(g as any).guest_email}</p>
                    )}
                    {g.guest_phone && (
                      <p className="text-xs text-muted-foreground">{g.guest_phone}</p>
                    )}
                  </div>
                  <Badge variant={statusVariant[g.status] || "secondary"} className="text-xs capitalize">
                    {g.status}
                  </Badge>
                </div>
                {isApproved && event && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-1.5 text-xs"
                    onClick={handleShare}
                  >
                    <Share2 className="h-3.5 w-3.5" />
                    Share Details with {g.guest_name.split(" ")[0]}
                  </Button>
                )}
              </div>
            );
          })}
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
              Guest Name <span className="text-destructive">*</span>
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
              <Mail className="mr-1 inline h-3 w-3" />
              Guest Email <span className="text-destructive">*</span>
            </Label>
            <Input
              type="email"
              value={guestEmail}
              onChange={(e) => setGuestEmail(e.target.value)}
              placeholder="guest@example.com"
              className="h-9"
            />
            <p className="mt-1 flex items-start gap-1 text-[10px] text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0 text-primary" />
              This email will be used to send the guest their ticket and event details once approved.
            </p>
          </div>
          <div>
            <Label className="mb-1 block text-xs font-medium">
              <Phone className="mr-1 inline h-3 w-3" />
              Guest Phone <span className="text-muted-foreground">(optional)</span>
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
