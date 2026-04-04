import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CoverPhotoUpload from "./CoverPhotoUpload";
import type { EventFormState } from "./types";

const EVENT_TYPES = ["physical", "online", "kids"] as const;

interface DesignTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
}

export default function DesignTab({ form, setForm }: DesignTabProps) {
  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-5 py-4">
      <CoverPhotoUpload
        value={form.cover_photo_url}
        onChange={(url) => update("cover_photo_url", url)}
      />

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

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="start">Start</Label>
          <Input
            id="start"
            type="datetime-local"
            value={form.date_time}
            onChange={(e) => update("date_time", e.target.value)}
            className="mt-1.5"
          />
        </div>
        <div>
          <Label htmlFor="end">End (optional)</Label>
          <Input
            id="end"
            type="datetime-local"
            value={form.end_date_time}
            onChange={(e) => update("end_date_time", e.target.value)}
            className="mt-1.5"
          />
        </div>
      </div>

      {(form.type === "physical" || form.type === "kids") && (
        <div>
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={form.location}
            onChange={(e) => update("location", e.target.value)}
            placeholder="Address"
            className="mt-1.5"
          />
        </div>
      )}

      {form.type === "online" && (
        <div>
          <Label htmlFor="virtual_link">Virtual Link</Label>
          <Input
            id="virtual_link"
            value={form.virtual_link}
            onChange={(e) => update("virtual_link", e.target.value)}
            placeholder="https://zoom.us/..."
            className="mt-1.5"
          />
        </div>
      )}
    </div>
  );
}
