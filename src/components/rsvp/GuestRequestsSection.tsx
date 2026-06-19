import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMyGuestRequests, useCreateGuestRequest, useCancelGuestRequest } from "@/hooks/useGuestRequests";
import { toast } from "sonner";
import { Loader2, UserPlus, Phone, User, Mail, Info, Share2, MessageSquare, Trash2 } from "lucide-react";
import { buildGuestWhatsAppUrl } from "@/lib/share-event";
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
  const cancelGuest = useCancelGuestRequest(eventId);
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
    if (guestEmail.trim() && !isValidEmail(guestEmail.trim())) {
      toast.error("Please enter a valid email address, or leave it blank.");
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

            const handleShare = async () => {
              if (!event) {
                toast.error("Event details unavailable.");
                return;
              }
              const waUrl = buildGuestWhatsAppUrl({
                guestName: g.guest_name,
                guestPhone: g.guest_phone,
                eventTitle: event.title,
                eventDateISO: event.date_time,
                location: event.location,
                address: event.address,
                onlineLink: event.online_link || event.virtual_link,
              });

              if (navigator.share) {
                const date = format(new Date(event.date_time), "EEEE, MMMM d 'at' h:mm a");
                const mapQuery = [event.location, event.address].filter(Boolean).join(", ");
                const mapUrl = mapQuery
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
                  : "";
                const lines = [
                  `Assalamu Alaikum ${g.guest_name}! 🌙`,
                  "",
                  `Your guest request for *${event.title}* on ${date} has been approved!`,
                ];
                if (event.location) lines.push("", `📍 ${event.location}`);
                if (event.address) lines.push(event.address);
                if (mapUrl) lines.push(`🗺 ${mapUrl}`);
                if (event.online_link || event.virtual_link) {
                  lines.push("", `🔗 Join online: ${event.online_link || event.virtual_link}`);
                }
                lines.push("", "Looking forward to seeing you there inshaAllah!");
                const message = lines.join("\n");
                try {
                  await navigator.share({ text: message });
                } catch (err: any) {
                  if (err?.name !== "AbortError") {
                    toast.error("Sharing failed.");
                  }
                }
              } else {
                window.open(waUrl, "_blank", "noopener");
              }
            };

            return (
              <div
                key={g.id}
                className="rounded-lg border border-border bg-card p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">{g.guest_name}</p>
                    {(g as any).guest_email && (
                      <p className="text-xs text-muted-foreground">{(g as any).guest_email}</p>
                    )}
                    {g.guest_phone && (
                      <p className="text-xs text-muted-foreground">{g.guest_phone}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant={statusVariant[g.status] || "secondary"} className="text-xs capitalize">
                      {g.status}
                    </Badge>
                    {g.status !== "rejected" && (
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Cancel guest request"
                        disabled={cancelGuest.isPending}
                        onClick={async () => {
                          if (!window.confirm(`Cancel guest request for ${g.guest_name}?`)) return;
                          try {
                            await cancelGuest.mutateAsync(g.id);
                            toast.success("Guest request cancelled.");
                          } catch {
                            toast.error("Failed to cancel guest request.");
                          }
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
                {(g as any).member_note && (
                  <div className="rounded-md border border-border bg-muted/30 p-2">
                    <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
                      <MessageSquare className="h-3 w-3" /> Note to admin
                    </p>
                    <p className="text-xs text-foreground whitespace-pre-wrap">{(g as any).member_note}</p>
                  </div>
                )}
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
          <div>
            <Label className="mb-1 block text-xs font-medium">
              <Mail className="mr-1 inline h-3 w-3" />
              Guest Email <span className="text-muted-foreground">(optional)</span>
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
              Optional. If provided, we'll email the guest their invite once approved. Otherwise, use the <strong>Share Details</strong> button after approval to send the info via WhatsApp.
            </p>
          </div>

          <div>
            <Label className="mb-1 block text-xs font-medium">
              <MessageSquare className="mr-1 inline h-3 w-3" />
              Notes for the admin <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              value={memberNote}
              onChange={(e) => setMemberNote(e.target.value.slice(0, NOTE_MAX))}
              placeholder="e.g. Family friend visiting from Cairo, has attended past gatherings."
              rows={3}
              className="text-sm"
            />
            <p className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Helps the admin decide on approval.</span>
              <span>{memberNote.length}/{NOTE_MAX}</span>
            </p>
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
