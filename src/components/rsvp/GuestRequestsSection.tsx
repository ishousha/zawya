import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useMyGuestRequests, useCreateGuestRequest, useCancelGuestRequest } from "@/hooks/useGuestRequests";
import {
  useMyExternalGuests,
  useUpsertExternalGuest,
  useDeleteExternalGuest,
  type ExternalGuest,
} from "@/hooks/useExternalGuests";
import { toast } from "sonner";
import { Loader2, UserPlus, Phone, User, Mail, Info, Share2, MessageSquare, Trash2, BookUser, Check, ChevronsUpDown, Pencil } from "lucide-react";
import { buildGuestWhatsAppUrl } from "@/lib/share-event";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
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
  const { data: savedGuests = [] } = useMyExternalGuests();
  const upsertSaved = useUpsertExternalGuest();
  const deleteSaved = useDeleteExternalGuest();

  const [showForm, setShowForm] = useState(false);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [memberNote, setMemberNote] = useState("");
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null);
  const [saveForLater, setSaveForLater] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const NOTE_MAX = 300;

  const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const resetForm = () => {
    setGuestName("");
    setGuestEmail("");
    setGuestPhone("");
    setMemberNote("");
    setSelectedSavedId(null);
    setSaveForLater(true);
  };

  const applySaved = (g: ExternalGuest) => {
    setSelectedSavedId(g.id);
    setGuestName(g.name);
    setGuestEmail(g.email ?? "");
    setGuestPhone(g.phone ?? "");
    setMemberNote(g.notes ?? "");
    setPickerOpen(false);
  };

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
      let externalGuestId = selectedSavedId;
      // Save / update the address-book entry first when requested
      if (!externalGuestId && saveForLater) {
        try {
          const saved = await upsertSaved.mutateAsync({
            name: guestName.trim(),
            email: guestEmail.trim() || null,
            phone: guestPhone.trim() || null,
            notes: memberNote.trim() || null,
          });
          externalGuestId = saved.id;
        } catch (err: any) {
          // Duplicate (unique index) is fine — request still goes through
          if (!String(err?.message || "").toLowerCase().includes("duplicate")) {
            console.warn("Failed to save guest for later:", err);
          }
        }
      }
      await createGuest.mutateAsync({
        guest_name: guestName.trim(),
        guest_email: guestEmail.trim(),
        guest_phone: guestPhone.trim() || undefined,
        member_note: memberNote.trim() || undefined,
        external_guest_id: externalGuestId,
      });
      toast.success("Guest request submitted for admin approval.");
      resetForm();
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
              const customMapsUrl = ((event as any).maps_url || "").trim();
              const mapQuery = [event.location, event.address].filter(Boolean).join(", ");
              const mapUrl = customMapsUrl
                ? customMapsUrl
                : mapQuery
                  ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`
                  : "";
              const waUrl = buildGuestWhatsAppUrl({
                guestName: g.guest_name,
                guestPhone: g.guest_phone,
                eventTitle: event.title,
                eventDateISO: event.date_time,
                location: event.location,
                address: event.address,
                mapsUrl: customMapsUrl || undefined,
                onlineLink: event.online_link || event.virtual_link,
              });

              if (navigator.share) {
                const date = format(new Date(event.date_time), "EEEE, MMMM d 'at' h:mm a");
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
          {/* Saved guests picker */}
          {savedGuests.length > 0 && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <Label className="block text-xs font-medium">
                  <BookUser className="mr-1 inline h-3 w-3" />
                  Pick from saved guests
                </Label>
                <button
                  type="button"
                  className="text-[10px] text-primary underline-offset-2 hover:underline"
                  onClick={() => setManageOpen(true)}
                >
                  Manage saved
                </button>
              </div>
              <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    className="h-9 w-full justify-between font-normal"
                  >
                    {selectedSavedId
                      ? savedGuests.find((g) => g.id === selectedSavedId)?.name ?? "Pick a saved guest"
                      : "Pick a saved guest or type a new one below"}
                    <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[110] bg-popover" align="start">
                  <Command>
                    <CommandInput placeholder="Search saved guests…" />
                    <CommandList>
                      <CommandEmpty>No saved guests match.</CommandEmpty>
                      <CommandGroup>
                        {savedGuests.map((g) => (
                          <CommandItem
                            key={g.id}
                            value={`${g.name} ${g.email ?? ""} ${g.phone ?? ""}`}
                            onSelect={() => applySaved(g)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", selectedSavedId === g.id ? "opacity-100" : "opacity-0")} />
                            <span className="truncate">
                              <span className="font-medium">{g.name}</span>
                              {g.phone && <span className="ml-1 text-muted-foreground text-xs">{g.phone}</span>}
                            </span>
                            <span className="ml-auto text-[10px] text-muted-foreground">
                              {g.times_invited}× invited
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              {selectedSavedId && (
                <button
                  type="button"
                  className="mt-1 text-[10px] text-muted-foreground underline-offset-2 hover:underline"
                  onClick={() => { setSelectedSavedId(null); resetForm(); }}
                >
                  Clear selection
                </button>
              )}
            </div>
          )}

          <div>
            <Label className="mb-1 block text-xs font-medium">
              <User className="mr-1 inline h-3 w-3" />
              Guest Name <span className="text-destructive">*</span>
            </Label>
            <Input
              value={guestName}
              onChange={(e) => { setGuestName(e.target.value); setSelectedSavedId(null); }}
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

          {!selectedSavedId && (
            <label className="flex items-start gap-2 rounded-md border border-border bg-card/50 p-2 text-xs">
              <Checkbox
                checked={saveForLater}
                onCheckedChange={(v) => setSaveForLater(!!v)}
                className="mt-0.5"
              />
              <span>
                <span className="font-medium">Save this guest for next time</span>
                <span className="block text-muted-foreground text-[10px]">
                  Adds them to your address book so you don't have to re-enter details.
                </span>
              </span>
            </label>
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={handleSubmit} disabled={createGuest.isPending} className="flex-1">
              {createGuest.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Submit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); resetForm(); }} className="flex-1">
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Manage saved guests modal */}
      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Saved guests</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-2 overflow-y-auto pt-2">
            {savedGuests.length === 0 ? (
              <p className="text-sm text-muted-foreground">You haven't saved any guests yet.</p>
            ) : (
              savedGuests.map((g) => (
                <div key={g.id} className="rounded-lg border border-border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{g.name}</p>
                      {g.email && <p className="text-xs text-muted-foreground">{g.email}</p>}
                      {g.phone && <p className="text-xs text-muted-foreground">{g.phone}</p>}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive"
                      title="Delete saved guest"
                      onClick={async () => {
                        if (!confirm(`Remove ${g.name} from your saved guests?`)) return;
                        try { await deleteSaved.mutateAsync(g.id); toast.success("Removed"); }
                        catch { toast.error("Failed to remove"); }
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <Badge variant="outline" className="text-[10px]">{g.times_invited} invited</Badge>
                    <Badge variant="outline" className="text-[10px]">{g.times_approved} approved</Badge>
                    {g.last_invited_at && (
                      <span>last invited {format(new Date(g.last_invited_at), "MMM d, yyyy")}</span>
                    )}
                  </div>
                  {g.notes && (
                    <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">{g.notes}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
