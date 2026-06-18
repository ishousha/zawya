import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Users, Clock, KeyRound, RefreshCw, UtensilsCrossed, Lock, Coins, BellRing, ScrollText, CalendarClock, Info, Film, Link2 } from "lucide-react";
import type { EventFormState } from "./types";
import { generateCheckinPin } from "./types";
import HostSelector from "./HostSelector";
import DateTimePicker from "./DateTimePicker";
import { useEventTypes } from "@/hooks/useEventTypes";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";


interface SettingsTabProps {
  form: EventFormState;
  setForm: React.Dispatch<React.SetStateAction<EventFormState>>;
  onShortCodeUserEdit?: () => void;
  onResetShortCode?: () => void;
}

export default function SettingsTab({ form, setForm, isEditing, onShortCodeUserEdit, onResetShortCode }: SettingsTabProps & { isEditing?: boolean }) {
  const update = <K extends keyof EventFormState>(key: K, value: EventFormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const { data: eventTypes } = useEventTypes();
  const selectedType = eventTypes?.find((t) => t.id === form.event_type_id);
  const isPurelyVirtual = selectedType ? !selectedType.requires_location : false;

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
            <Label htmlFor="capacity">Max Capacity (Optional)</Label>
            <Input
              id="capacity"
              type="number"
              min={1}
              value={form.capacity}
              onChange={(e) => update("capacity", e.target.value)}
              placeholder="Unlimited"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Leave blank for unlimited
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
        <div className="flex items-center justify-between rounded-lg border border-border p-3 mt-2">
          <div>
            <p className="text-sm font-medium text-foreground">Allow Guest Requests</p>
            <p className="text-xs text-muted-foreground">
              When off, members can't add guests during RSVP. Admins can still add walk-in guests at the door.
            </p>
          </div>
          <Switch
            checked={form.allow_guests !== false}
            onCheckedChange={(v) => update("allow_guests", v)}
          />
        </div>
      </div>

      {/* Event Fee */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Event Fee (AED)</h3>
        </div>
        <div className="relative">
          <Input
            type="number"
            min={0}
            step="0.01"
            value={form.ticket_fee}
            onChange={(e) => update("ticket_fee", e.target.value)}
            placeholder="0 for free"
            className="pr-14"
          />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">
            AED
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Leave as 0 for free events. Fee is collected offline in AED.
        </p>
      </div>

      {/* Event Host */}
      <HostSelector
        hostId={form.host_id}
        onChange={(id) => update("host_id", id)}
      />

      {/* Potluck Toggle */}
      <div className={isPurelyVirtual ? "opacity-50" : ""}>
        <div className="flex items-center gap-2 mb-3">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Potluck</h3>
          {isPurelyVirtual && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Not applicable for virtual events.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Is this a Potluck?</p>
            <p className="text-xs text-muted-foreground">
              {isPurelyVirtual ? "Not applicable for virtual events." : "Members can share what dish they're bringing"}
            </p>
          </div>
          <Switch
            checked={isPurelyVirtual ? false : form.has_potluck}
            onCheckedChange={(v) => update("has_potluck", v)}
            disabled={isPurelyVirtual}
          />
        </div>
      </div>

      {/* Check-in PIN */}
      <div className={isPurelyVirtual ? "opacity-50" : ""}>
        <div className="flex items-center gap-2 mb-3">
          <KeyRound className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Self Check-in PIN</h3>
          {isPurelyVirtual && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-3.5 w-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>Not applicable for virtual events.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
            disabled={isPurelyVirtual}
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => update("checkin_pin", generateCheckinPin())}
            title="Generate new PIN"
            disabled={isPurelyVirtual}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {isPurelyVirtual ? "Not applicable for virtual events." : "Members enter this PIN at the door to self check-in"}
        </p>
      </div>

      {/* Custom Short Link */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Custom Short Link (Optional)</h3>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center rounded-md border border-input bg-muted/40 px-2.5 text-sm text-muted-foreground">
            zawya.app/e/
          </div>
          <Input
            id="short_code"
            type="text"
            maxLength={32}
            value={form.short_code}
            onChange={(e) => {
              const sanitized = e.target.value.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
              update("short_code", sanitized);
              onShortCodeUserEdit?.();
            }}
            placeholder="TG1405"
            className="font-mono"
          />
          {onResetShortCode && (
            <Button
              type="button"
              size="icon"
              variant="outline"
              onClick={onResetShortCode}
              title="Re-suggest from title + date"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Auto-suggested from title + date. Edit freely — if it's already taken, we'll append <span className="font-mono">-2</span>.
          {form.short_code && form.short_code.length > 0 && form.short_code.length < 3 && (
            <span className="block text-destructive">Use 3–32 characters: letters, numbers, _ or -.</span>
          )}
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
          <SelectContent className="z-[90]">
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground mt-1">
          'Full' status is set automatically when RSVPs reach max capacity
        </p>
      </div>

      {/* Publish Toggle */}
      {isEditing && (
        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <p className="text-sm font-medium text-foreground">Published</p>
            <p className="text-xs text-muted-foreground">
              {form.published
                ? "Visible to members. Toggle off to hide as draft."
                : "Currently a draft. Only admins can see it."}
            </p>
          </div>
          <Switch
            checked={form.published}
            onCheckedChange={(v) => update("published", v)}
          />
        </div>
      )}

      {/* Scheduled Publish */}
      {!form.published && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Scheduled Publish</h3>
          </div>
          <DateTimePicker
            value={form.scheduled_publish_at}
            onChange={(v) => update("scheduled_publish_at", v)}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {form.scheduled_publish_at
              ? "This draft will auto-publish at the selected time and notify all members."
              : "Optional — set a future date/time to auto-publish this draft."}
          </p>
        </div>
      )}

      {/* Etiquette / Adab Notes */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ScrollText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Gathering Etiquette</h3>
        </div>
        <Textarea
          value={form.etiquette_notes}
          onChange={(e) => update("etiquette_notes", e.target.value)}
          placeholder="E.g. Please park responsibly, arrive on time, and keep phones on silent..."
          rows={3}
          className="resize-none"
        />
        <p className="text-xs text-muted-foreground mt-1">
          Custom rules shown to attendees. Leave blank for default community etiquette.
        </p>
      </div>

      {/* Notification Options */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <BellRing className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
        </div>
        <div className="space-y-3">
          {!isEditing && (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={form.notify_members}
                onCheckedChange={(v) => update("notify_members", !!v)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Notify all approved members</p>
                <p className="text-xs text-muted-foreground">
                  Send an in-app notification about this new event to all approved members
                </p>
              </div>
            </label>
          )}
          {isEditing && (
            <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-accent/50 transition-colors">
              <Checkbox
                checked={form.notify_attendees}
                onCheckedChange={(v) => update("notify_attendees", !!v)}
                className="mt-0.5"
              />
              <div>
                <p className="text-sm font-medium text-foreground">Notify attendees of changes</p>
                <p className="text-xs text-muted-foreground">
                  Send an in-app notification to all users with an active RSVP
                </p>
              </div>
            </label>
          )}
        </div>
      </div>

      {/* Post-Event Media */}
      {isEditing && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Film className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Post-Event Media</h3>
          </div>
          <div className="space-y-3">
            <div>
              <Label htmlFor="recording_url">Recording Link (URL)</Label>
              <Input
                id="recording_url"
                type="url"
                value={form.recording_url}
                onChange={(e) => update("recording_url", e.target.value)}
                placeholder="https://zoom.us/rec/share/..."
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="recording_passcode">Recording Passcode</Label>
              <Input
                id="recording_passcode"
                type="text"
                value={form.recording_passcode}
                onChange={(e) => update("recording_passcode", e.target.value)}
                placeholder="Optional passcode"
                className="mt-1.5"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Add a Zoom recording link after the event ends. Members will see a "Watch Recording" button on the past event card.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
