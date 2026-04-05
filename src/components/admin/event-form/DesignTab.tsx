import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, AlertCircle } from "lucide-react";
import CoverPhotoUpload from "./CoverPhotoUpload";
import VenueSelector from "./VenueSelector";
import type { EventFormState } from "./types";

const EVENT_TYPES = ["physical", "online", "kids"] as const;

interface DesignTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
}

export default function DesignTab({ form, setForm }: DesignTabProps) {
  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const endBeforeStart =
    form.date_time && form.end_date_time && form.end_date_time <= form.date_time;

  const showPhysical =
    form.is_hybrid || form.type === "physical" || form.type === "kids";
  const showVirtual = form.is_hybrid || form.type === "online";

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
      <div className="grid grid-cols-2 gap-3 items-end">
        <div>
          <Label>Event Type</Label>
          <Select
            value={form.type}
            onValueChange={(v) => update("type", v as EventFormState["type"])}
          >
            <SelectTrigger className="mt-1.5">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="capitalize">
                  {t}
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
