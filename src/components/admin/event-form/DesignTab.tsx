import { useEffect, useState, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Video, AlertCircle, Info, DollarSign, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";
import CoverPhotoUpload from "./CoverPhotoUpload";
import VenueSelector from "./VenueSelector";
import SpeakerSelector from "./SpeakerSelector";
import type { EventFormState } from "./types";
import { AGE_GROUP_OPTIONS } from "./types";

const DURATION_OPTIONS = [
  { label: "30 minutes", minutes: 30 },
  { label: "1 hour", minutes: 60 },
  { label: "1.5 hours", minutes: 90 },
  { label: "2 hours", minutes: 120 },
  { label: "3 hours", minutes: 180 },
  { label: "All Day", minutes: 1440 },
  { label: "Custom", minutes: -1 },
] as const;

function minutesBetween(start: string, end: string): number {
  if (!start || !end) return -1;
  return (new Date(end).getTime() - new Date(start).getTime()) / 60000;
}

function addMinutesToDatetime(dt: string, mins: number): string {
  const d = new Date(dt);
  d.setMinutes(d.getMinutes() + mins);
  // Format as datetime-local value
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function detectDuration(start: string, end: string): string {
  const mins = minutesBetween(start, end);
  const match = DURATION_OPTIONS.find((o) => o.minutes === mins);
  return match ? match.label : "Custom";
}
import { useEventTypes } from "@/hooks/useEventTypes";

interface DesignTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  isEditing?: boolean;
}

export default function DesignTab({ form, setForm, isEditing }: DesignTabProps) {
  const [bookingZoom, setBookingZoom] = useState(false);
  const [zoomError, setZoomError] = useState<string | null>(null);

  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Detect if current link is a Zoom URL and extract meeting ID
  const isZoomUpdate = /zoom\.us/i.test(form.online_link);
  const extractZoomMeetingId = (url: string): string | null => {
    const match = url.match(/\/j\/(\d+)/);
    return match ? match[1] : null;
  };

  const handleGenerateZoom = async () => {
    if (!form.title || !form.date_time) {
      toast.error("Please fill in the event title and start time first.");
      return;
    }
    setBookingZoom(true);
    setZoomError(null);
    try {
      const startIso = new Date(form.date_time).toISOString();
      const payload: Record<string, unknown> = { title: form.title, start_time: startIso };

      if (isZoomUpdate) {
        const mid = extractZoomMeetingId(form.online_link);
        if (mid) payload.meeting_id = mid;
      }

      const res = await fetch("https://n8n.seqwelpartners.com/webhook/create-zoom-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Webhook returned " + res.status);

      if (isZoomUpdate) {
        // Update response may be minimal (e.g. {"status":"updated"}) — no need to parse join_url
        try { await res.json(); } catch { /* ignore empty body */ }
        toast.success("Zoom meeting time updated!");
        setZoomError(null);
      } else {
        const data = await res.json();
        const joinUrl = data.join_url ?? data.joinUrl ?? "";
        if (!joinUrl) throw new Error("No Zoom link returned — unexpected response format.");
        const meetingId = data.id ?? data.meeting_id ?? "";
        const password = data.password ?? "";
        setForm((prev) => {
          const meetingNote = meetingId ? `Meeting ID: ${meetingId}` : "";
          const sep = meetingNote && prev.description ? "\n\n" : "";
          return {
            ...prev,
            online_link: joinUrl,
            zoom_password: password,
            description: meetingNote ? prev.description + sep + meetingNote : prev.description,
          };
        });
        toast.success("Zoom meeting booked successfully!");
      }
    } catch (err: any) {
      const msg = err.message || "Failed to process Zoom request";
      setZoomError(msg);
      toast.error(msg);
    } finally {
      setBookingZoom(false);
    }
  };

  const { data: eventTypes } = useEventTypes();
  const selectedType = eventTypes?.find((t) => t.id === form.event_type_id);

  // Smart defaults based on event type selection
  // Smart defaults based on event type selection
  const prevEventTypeId = useRef(form.event_type_id);
  const hasMountedRef = useRef(false);
  useEffect(() => {
    if (!selectedType) return;

    const isInitialMount = !hasMountedRef.current;
    hasMountedRef.current = true;

    // On initial mount when editing, skip ONLY if the form already
    // reflects the event-type defaults (i.e. DB-stored overrides exist).
    // enable_virtual is not persisted, so we always need to derive it
    // from the event type on first load.
    const typeActuallyChanged = prevEventTypeId.current !== form.event_type_id;
    if (!typeActuallyChanged && !isInitialMount && isEditing) return;
    prevEventTypeId.current = form.event_type_id;

    setForm((prev) => {
      const next = { ...prev };
      if (isInitialMount && isEditing) {
        // On first load in edit mode, only set enable_virtual from type
        // if the DB didn't provide a link (i.e. the user hasn't overridden)
        next.enable_virtual = prev.enable_virtual || selectedType.is_virtual;
        // has_potluck is persisted in DB, so keep the saved value on first load
      } else {
        next.enable_virtual = selectedType.is_virtual;
        next.has_potluck = selectedType.allows_potluck;
      }
      return next;
    });
  }, [form.event_type_id, selectedType, setForm, isEditing]);

  const endBeforeStart =
    form.date_time && form.end_date_time && form.end_date_time <= form.date_time;

  // Derive visibility from event type flags
  const requiresLocation = selectedType?.requires_location ?? true;
  const allowsPotluck = selectedType?.allows_potluck ?? true;

  const showPhysical = requiresLocation;
  const showVirtual = form.enable_virtual;

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
        {showVirtual && showPhysical && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            This is a hybrid event — both a physical venue and virtual link are shown.
          </p>
        )}
      </div>

      {/* Virtual / Zoom toggle */}
      <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2.5 bg-muted/30">
        <Switch
          id="enable_virtual"
          checked={form.enable_virtual}
          onCheckedChange={(v) => {
            update("enable_virtual", v);
            if (!v) {
              setForm((prev) => ({ ...prev, online_link: "", zoom_password: "" }));
            }
          }}
        />
        <Label htmlFor="enable_virtual" className="text-sm cursor-pointer mb-0 flex items-center gap-1.5">
          <Video className="h-3.5 w-3.5 text-primary" />
          Enable Virtual / Zoom Meeting
        </Label>
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

      {/* Zoom booking + online link — only for virtual event types */}
      {showVirtual && (
        <>
          <div className="rounded-md border border-border p-3 bg-muted/30 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5 mb-0 text-sm">
                <Video className="h-4 w-4 text-primary" />
                {isZoomUpdate ? "Zoom Meeting Linked" : "One-Click Zoom Booking"}
              </Label>
              <Button
                type="button"
                size="sm"
                variant={zoomError ? "destructive" : isZoomUpdate ? "secondary" : "outline"}
                disabled={bookingZoom}
                onClick={handleGenerateZoom}
                className="gap-1.5"
              >
                {bookingZoom ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Video className="h-3.5 w-3.5" />}
                {bookingZoom
                  ? isZoomUpdate ? "Updating…" : "Booking…"
                  : zoomError ? "Retry"
                  : isZoomUpdate ? "Update Zoom Time" : "Generate Zoom Link"}
              </Button>
            </div>
            {zoomError && (
              <p className="flex items-center gap-1 text-xs text-destructive">
                <AlertCircle className="h-3 w-3 shrink-0" />
                {zoomError}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {isZoomUpdate
                ? "Updates the meeting start time on Zoom to match this event."
                : "Generates a Zoom meeting and fills in the link + meeting details automatically."}
            </p>
          </div>

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
          </div>

          <div>
            <Label htmlFor="zoom_password">Meeting Passcode (Optional)</Label>
            <Input
              id="zoom_password"
              value={form.zoom_password}
              onChange={(e) => update("zoom_password", e.target.value)}
              placeholder="e.g. 123456"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Auto-filled by Zoom booking, or enter manually for any platform.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
