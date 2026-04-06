import { useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, AlertCircle, Info, DollarSign } from "lucide-react";
import CoverPhotoUpload from "./CoverPhotoUpload";
import VenueSelector from "./VenueSelector";
import type { EventFormState, EventType } from "./types";
import { EVENT_TYPE_LABELS } from "./types";

const EVENT_TYPES = Object.keys(EVENT_TYPE_LABELS) as EventType[];

interface DesignTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
}

export default function DesignTab({ form, setForm }: DesignTabProps) {
  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // Smart defaults based on type + location
  useEffect(() => {
    setForm((prev) => {
      const next = { ...prev };
      const isVirtualOnly = prev.type === "class" && !prev.is_hybrid && prev.virtual_link && !prev.location;

      switch (prev.type) {
        case "gathering":
          next.has_potluck = true;
          next.ticket_fee = "0";
          break;
        case "class":
          // Virtual-only class: force potluck off
          if (!prev.is_hybrid && !prev.location) {
            next.has_potluck = false;
          }
          break;
        case "meeting":
        case "nasiha":
          next.has_potluck = false;
          break;
        // trip and retreat: keep potluck toggleable, fee visible
      }
      return next;
    });
  }, [form.type, form.is_hybrid, form.location, setForm]);

  const endBeforeStart =
    form.date_time && form.end_date_time && form.end_date_time <= form.date_time;

  const isNasiha = form.type === "nasiha";
  const showPhysical = !isNasiha && (form.is_hybrid || form.type !== "class");
  const showVirtual = !isNasiha && (form.is_hybrid || form.type === "class");
  const showHybridToggle = !isNasiha;

  // Potluck toggle: hide entirely for nasiha/meeting, lock for gathering & virtual-only class
  const hidePotluckToggle = isNasiha || form.type === "meeting";
  const potluckLocked =
    form.type === "gathering" ||
    (form.type === "class" && !form.is_hybrid && !form.location);

  // Fee visibility
  const showFee = form.type === "trip" || form.type === "retreat";

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

      {/* Type + Hybrid toggle row */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3 items-end">
          <div>
            <Label>Event Type</Label>
            <Select
              value={form.type}
              onValueChange={(v) => update("type", v as EventType)}
            >
              <SelectTrigger className="mt-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {EVENT_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 h-10 rounded-md border border-border px-3 bg-muted/30">
            <Switch
              id="hybrid"
              checked={form.is_hybrid}
              onCheckedChange={(v) => update("is_hybrid", v)}
            />
            <Label htmlFor="hybrid" className="text-sm cursor-pointer mb-0">
              Hybrid
            </Label>
          </div>
        </div>

        {/* Type-specific notes */}
        {form.type === "trip" && (
          <p className="flex items-start gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md p-2.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
            RSVP will require members to select dependents for this event type.
          </p>
        )}
      </div>

      {/* Potluck toggle */}
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
            {form.type === "gathering" ? "Always on" : "Auto off"}
          </span>
        )}
      </div>

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
      <div className="grid grid-cols-2 gap-3">
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
      )}

      {showVirtual && (
        <div>
          <Label htmlFor="virtual_link" className="flex items-center gap-1.5">
            <Video className="h-3.5 w-3.5 text-primary" />
            Virtual Link
          </Label>
          <Input
            id="virtual_link"
            value={form.virtual_link}
            onChange={(e) => update("virtual_link", e.target.value)}
            placeholder="https://zoom.us/... or meet.google.com/..."
            className="mt-1.5"
          />
        </div>
      )}
    </div>
  );
}
