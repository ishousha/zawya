import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Clock } from "lucide-react";
import type { EventFormState } from "./types";

interface SettingsTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
}

export default function SettingsTab({ form, setForm }: SettingsTabProps) {
  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-6 py-4">
      {/* Event Requirements Section */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event Requirements</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="capacity">Event Capacity</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value)}
              placeholder="Max attendees"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Maximum total attendees
            </p>
          </div>
          <div>
            <Label htmlFor="waitlist_capacity">Waitlist Capacity</Label>
            <Input
              id="waitlist_capacity"
              type="number"
              min={0}
              value={form.waitlist_capacity}
              onChange={(e) => update("waitlist_capacity", e.target.value)}
              placeholder="Waitlist slots"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Extra slots for waitlist
            </p>
          </div>
        </div>
      </div>

      {/* Event Status */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event Status</h3>
        </div>

        <Select value={form.status} onValueChange={(v) => update("status", v as EventFormState["status"])}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="full">Full</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          Set to 'Cancelled' to hide from member feeds
        </p>
      </div>
    </div>
  );
}
