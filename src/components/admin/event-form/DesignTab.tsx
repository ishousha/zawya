import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Video, AlertCircle, Info, DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";
import CoverPhotoUpload from "./CoverPhotoUpload";
import VenueSelector from "./VenueSelector";
import SpeakerSelector from "./SpeakerSelector";
import type { EventFormState } from "./types";
import { AGE_GROUP_OPTIONS } from "./types";
import { useEventTypes } from "@/hooks/useEventTypes";

interface DesignTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
}

export default function DesignTab({ form, setForm }: DesignTabProps) {
  const [bookingZoom, setBookingZoom] = useState(false);
  const [zoomError, setZoomError] = useState<string | null>(null);

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleGenerateZoom = async () => {
    if (!form.title || !form.date_time) {
      toast.error("Please fill in the event title and start time first.");
      return;
    }
    setBookingZoom(true);
    setZoomError(null);
    try {
      const startIso = new Date(form.date_time).toISOString();
      const res = await fetch("https://n8n.seqwelpartners.com/webhook/create-zoom-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.title, start_time: startIso }),
      });
      if (!res.ok) throw new Error("Webhook returned " + res.status);
      const data = await res.json();
      const joinUrl = data.join_url ?? data.joinUrl ?? "";
      if (!joinUrl) throw new Error("No Zoom link returned — unexpected response format.");
      const meetingId = data.id ?? data.meeting_id ?? "";
      const password = data.password ?? "";
      setForm((prev) => {
        const details = [
          meetingId && `Meeting ID: ${meetingId}`,
          password && `Password: ${password}`,
        ].filter(Boolean).join("\n");
        const sep = prev.description ? "\n\n" : "";
        return {
          ...prev,
          online_link: joinUrl,
          description: details ? prev.description + sep + details : prev.description,
        };
      });
      toast.success("Zoom meeting booked successfully!");
    } catch (err: any) {
      const msg = err.message || "Failed to generate Zoom link";
      setZoomError(msg);
      toast.error(msg);
    } finally {
      setBookingZoom(false);
    }
  };

  const { data: eventTypes } = useEventTypes();
  const selectedType = eventTypes?.find((t) => t.id === form.event_type_id);

  // Smart defaults based on event type properties
  useEffect(() => {
    if (!selectedType) return;
    setForm((prev) => {
      const next = { ...prev };
      const stIsVirtual = selectedType.is_virtual ?? false;

      // Set is_hybrid based on both flags
      next.is_hybrid = selectedType.requires_location && stIsVirtual;

      if (!selectedType.allows_potluck) {
        next.has_potluck = false;
      }
      if (selectedType.name.toLowerCase().includes("gathering")) {
        next.has_potluck = true;
        next.ticket_fee = "0";
      }
      return next;
    });
  }, [form.event_type_id, selectedType, setForm]);

  const endBeforeStart =
    form.date_time && form.end_date_time && form.end_date_time <= form.date_time;

  // Derive visibility from event type flags
  const requiresLocation = selectedType?.requires_location ?? true;
  const isVirtual = selectedType?.is_virtual ?? false;
  const allowsPotluck = selectedType?.allows_potluck ?? true;

  const showPhysical = requiresLocation;
  const showVirtual = isVirtual;

  // Potluck toggle visibility
  const hidePotluckToggle = !allowsPotluck;
  const potluckLocked = selectedType?.name.toLowerCase().includes("gathering") ?? false;

  // Fee visibility — show for trip/retreat type names
  const typeName = selectedType?.name.toLowerCase() ?? "";
  const showFee = typeName.includes("trip") || typeName.includes("retreat");

  return (
    <div className="space-y-5 py-4">
      {/* Cover Photo */}
      <CoverPhotoUpload
        value={form.cover_photo_url}
        onChange={(url) => update("cover_photo_url", url)}
      />

      {/* Title */}
      <div>
        <Label htmlFor="title">Event Title</Label>
        <Input
          id="title"
          value={form.title}
          onChange={(e) => update("title", e.target.value)}
          placeholder="e.g. Friday Gathering"
          className="mt-1.5"
        />
      </div>

      {/* Description */}
      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={form.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Add details about this event…"
          className="mt-1.5 min-h-[100px]"
        />
      </div>

      <div className="space-y-3">
        <div>
          <Label>Event Type</Label>
          <Select
            value={form.event_type_id}
            onValueChange={(v) => update("event_type_id", v)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select type..." />
            </SelectTrigger>
            <SelectContent>
              {eventTypes?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Age Group */}
        <div>
          <Label>Target Age Group</Label>
          <Select
            value={form.age_group}
            onValueChange={(v) => update("age_group", v)}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue placeholder="Select age group..." />
            </SelectTrigger>
            <SelectContent>
              {AGE_GROUP_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Speaker Selector — below Event Type */}
        <SpeakerSelector
          selectedIds={form.speaker_ids}
          onChange={(ids) => update("speaker_ids", ids)}
        />

        {/* Type-specific notes */}
        {typeName.includes("trip") && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            RSVP will require members to select dependents for this event type.
          </p>
        )}
        {showVirtual && !showPhysical && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            This event type is online-only. Potluck sign-ups are disabled.
          </p>
        )}
        {showVirtual && showPhysical && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            This is a hybrid event — both a physical venue and virtual link are shown.
          </p>
        )}
      </div>

      {/* Potluck toggle — hidden when type doesn't allow it */}
      {!hidePotluckToggle && (
        <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 bg-muted/30">
          <Switch
            id="has_potluck"
            checked={form.has_potluck}
            onCheckedChange={(v) => update("has_potluck", v)}
            disabled={potluckLocked}
          />
          <Label htmlFor="has_potluck" className="text-sm cursor-pointer mb-0">
            Enable Potluck / Sign-up Items
          </Label>
          {potluckLocked && (
            <span className="ml-auto text-xs text-muted-foreground">
              Always on
            </span>
          )}
        </div>
      )}

      {/* Ticket Fee */}
      {showFee && (
        <div>
          <Label htmlFor="ticket_fee" className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5 text-primary" />
            Ticket Fee / Cost (AED)
          </Label>
          <Input
            id="ticket_fee"
            type="number"
            min={0}
            step="0.01"
            value={form.ticket_fee}
            onChange={(e) => update("ticket_fee", e.target.value)}
            placeholder="0"
            className="mt-1.5"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Leave at 0 for free events
          </p>
          {parseFloat(form.ticket_fee) > 0 && (
            <div className="mt-3">
              <Label htmlFor="payment_instructions">Payment Instructions (Optional)</Label>
              <Textarea
                id="payment_instructions"
                value={form.payment_instructions}
                onChange={(e) => update("payment_instructions", e.target.value)}
                placeholder="e.g., Please transfer to IBAN AE12... or Bring cash to the door."
                className="mt-1.5 min-h-[80px]"
              />
            </div>
          )}
        </div>
      )}

      {/* Start & End date/time */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start">Start Date & Time</Label>
          <Input
            id="start"
            type="datetime-local"
            value={form.date_time}
            onChange={(e) => update("date_time", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="end">End Date & Time</Label>
          <Input
            id="end"
            type="datetime-local"
            value={form.end_date_time}
            onChange={(e) => update("end_date_time", e.target.value)}
            min={form.date_time || undefined}
            className={`mt-1.5 ${endBeforeStart ? "border-destructive focus-visible:ring-destructive" : ""}`}
          />
          {endBeforeStart && (
            <p className="flex items-center gap-1 text-xs text-destructive mt-1">
              <AlertCircle className="h-3 w-3" />
              End must be after start
            </p>
          )}
        </div>
      </div>

      {/* Venue selector — conditional on type + hybrid */}
      {showPhysical && (
        <>
          <VenueSelector
            value={form.venue_id}
            onChange={(venueId, name, address) =>
              setForm((prev) => ({
                ...prev,
                venue_id: venueId,
                location: name,
                address: address,
              }))
            }
          />
          <div>
            <Label htmlFor="location_hint">General Area / Hint (e.g., Barsha 3)</Label>
            <Input
              id="location_hint"
              value={form.location_hint}
              onChange={(e) => update("location_hint", e.target.value)}
              placeholder="e.g. Barsha 3, JLT Cluster D"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Shown to members before they RSVP. Exact address is revealed after RSVP.
            </p>
          </div>
        </>
      )}

      {/* Generate Zoom Link — available for all event types */}
      <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1.5 mb-0 text-sm">
            <Video className="h-4 w-4 text-primary" />
            One-Click Zoom Booking
          </Label>
          <Button
            type="button"
            size="sm"
            variant={zoomError ? "destructive" : "outline"}
            disabled={bookingZoom}
            onClick={handleGenerateZoom}
            className="gap-1.5"
          >
            {bookingZoom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
            {bookingZoom ? "Booking…" : zoomError ? "Retry" : "Generate Zoom Link"}
          </Button>
        </div>
        {zoomError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <AlertCircle className="h-3 w-3 shrink-0" />
            {zoomError}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Generates a Zoom meeting and fills in the link + meeting details automatically.
        </p>
      </div>

      {/* Online link field — always visible so admins can paste or see the generated link */}
      <div>
        <Label htmlFor="online_link" className="flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-primary" />
          Online Meeting Link
        </Label>
        <Input
          id="online_link"
          value={form.online_link}
          onChange={(e) => update("online_link", e.target.value)}
          placeholder="https://zoom.us/... or meet.google.com/..."
          className="mt-1.5"
        />
        {!showVirtual && form.online_link && (
          <p className="flex items-start gap-1 text-xs text-muted-foreground mt-1">
            <Info className="h-3 w-3 mt-0.5 shrink-0" />
            This link will be shared with attendees even though the event type isn't virtual.
          </p>
        )}
      </div>
    </div>
  );
}
