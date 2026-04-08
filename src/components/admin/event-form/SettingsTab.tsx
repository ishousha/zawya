import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Users, Clock, KeyRound, RefreshCw, UtensilsCrossed, Lock, DollarSign } from "lucide-react";
import type { EventFormState } from "./types";
import { generateCheckinPin } from "./types";
import HostSelector from "./HostSelector";


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

      {/* Mureeds Only Toggle */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Access Control</h3>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Private Event (Mureeds Only)</p>
            <p className="text-xs text-muted-foreground">
              Only users marked as Mureeds will see this event
            </p>
          </div>
          <Switch
            checked={form.mureeds_only}
            onCheckedChange={(v) => update("mureeds_only", v)}
          />
        </div>
      </div>

      {/* Event Fee */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event Fee</h3>
        </div>
        <Input
          type="number"
          min={0}
          step="0.01"
          value={form.ticket_fee}
          onChange={(e) => update("ticket_fee", e.target.value)}
          placeholder="0 for free"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Leave as 0 for free events. Fee is collected offline.
        </p>
      </div>

      {/* Event Host */}
      <HostSelector
        hostId={form.host_id}
        onChange={(id) => update("host_id", id)}
      />

      {/* Potluck Toggle */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Potluck</h3>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Is this a Potluck?</p>
            <p className="text-xs text-muted-foreground">
              Members can share what dish they're bringing
            </p>
          </div>
          <Switch
            checked={form.has_potluck}
            onCheckedChange={(v) => update("has_potluck", v)}
          />
        </div>
      </div>

      {/* Check-in PIN */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Self Check-in PIN</h3>
        </div>
        <div className="flex gap-2">
          <Input
            id="checkin_pin"
            type="text"
            maxLength={4}
            inputMode="numeric"
            pattern="[0-9]*"
            value={form.checkin_pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "").slice(0, 4);
              update("checkin_pin", val);
            }}
            placeholder="4-digit PIN"
            className="font-mono text-lg tracking-[0.3em] max-w-32"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => update("checkin_pin", generateCheckinPin())}
            title="Generate new PIN"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Members enter this PIN at the door to self check-in
        </p>
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
