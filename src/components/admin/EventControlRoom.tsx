import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Edit2, X, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

type EventInsert = Database["public"]["Tables"]["events"]["Insert"];
type EventRow = Database["public"]["Tables"]["events"]["Row"];

const EVENT_TYPES: Database["public"]["Enums"]["event_type"][] = ["physical", "online", "kids"];
const POTLUCK_CATEGORIES: Database["public"]["Enums"]["potluck_category"][] = ["main", "side", "dessert", "drinks"];

export default function EventControlRoom() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [monitoringEventId, setMonitoringEventId] = useState<string | null>(null);

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 py-4">
      {!creating && !editing && !monitoringEventId && (
        <>
          <Button onClick={() => setCreating(true)} className="w-full gap-2 h-12">
            <Plus className="h-5 w-5" /> Create Event
          </Button>

          <div className="space-y-2">
            {events?.map((event) => (
              <Card key={event.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-card-foreground">{event.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(event.date_time), "PPP p")}
                      </p>
                      <div className="mt-1 flex gap-1.5">
                        <Badge variant="secondary" className="text-xs capitalize">{event.type}</Badge>
                        <Badge variant={event.status === "active" ? "default" : "destructive"} className="text-xs capitalize">
                          {event.status}
                        </Badge>
                        {event.capacity && (
                          <Badge variant="outline" className="text-xs">Cap: {event.capacity}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="ml-2 flex gap-1">
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setMonitoringEventId(event.id)}>
                        <Users className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-10 w-10" onClick={() => setEditing(event)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {creating && (
        <EventForm onClose={() => setCreating(false)} />
      )}

      {editing && (
        <EventForm event={editing} onClose={() => setEditing(null)} />
      )}

      {monitoringEventId && (
        <RSVPMonitor eventId={monitoringEventId} onClose={() => setMonitoringEventId(null)} />
      )}
    </div>
  );
}

function EventForm({ event, onClose }: { event?: EventRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(event?.title ?? "");
  const [dateTime, setDateTime] = useState(event?.date_time ? format(new Date(event.date_time), "yyyy-MM-dd'T'HH:mm") : "");
  const [type, setType] = useState<Database["public"]["Enums"]["event_type"]>(event?.type ?? "physical");
  const [location, setLocation] = useState(event?.location ?? "");
  const [zoomLink, setZoomLink] = useState(event?.zoom_link ?? "");
  const [capacity, setCapacity] = useState(event?.capacity?.toString() ?? "");
  const [status, setStatus] = useState<Database["public"]["Enums"]["event_status"]>(event?.status ?? "active");

  // Potluck config state
  const [potluckSlots, setPotluckSlots] = useState<Record<string, string>>({});

  const { data: existingPotluck } = useQuery({
    queryKey: ["potluck-config", event?.id],
    enabled: !!event?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("potluck_config")
        .select("*")
        .eq("event_id", event!.id);
      if (error) throw error;
      const slots: Record<string, string> = {};
      data?.forEach((c) => { slots[c.category] = c.max_slots.toString(); });
      setPotluckSlots(slots);
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: EventInsert = {
        title,
        date_time: new Date(dateTime).toISOString(),
        type,
        location: location || null,
        zoom_link: zoomLink || null,
        capacity: capacity ? parseInt(capacity) : null,
        status,
      };

      let eventId = event?.id;
      if (event) {
        const { error } = await supabase.from("events").update(payload).eq("id", event.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select("id").single();
        if (error) throw error;
        eventId = data.id;
      }

      // Upsert potluck config
      if (eventId) {
        // Delete existing configs
        await supabase.from("potluck_config").delete().eq("event_id", eventId);
        // Insert new ones
        const configs = POTLUCK_CATEGORIES
          .filter((cat) => potluckSlots[cat] && parseInt(potluckSlots[cat]) > 0)
          .map((cat) => ({
            event_id: eventId!,
            category: cat,
            max_slots: parseInt(potluckSlots[cat]),
          }));
        if (configs.length > 0) {
          const { error } = await supabase.from("potluck_config").insert(configs);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      queryClient.invalidateQueries({ queryKey: ["potluck-config"] });
      toast.success(event ? "Event updated" : "Event created");
      onClose();
    },
    onError: () => toast.error("Failed to save event"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">{event ? "Edit Event" : "New Event"}</CardTitle>
        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label htmlFor="title">Title</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Gathering name" />
        </div>
        <div>
          <Label htmlFor="datetime">Date & Time</Label>
          <Input id="datetime" type="datetime-local" value={dateTime} onChange={(e) => setDateTime(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as any)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="full">Full</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {(type === "physical" || type === "kids") && (
          <div>
            <Label htmlFor="location">Location</Label>
            <Input id="location" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Address" />
          </div>
        )}
        {type === "online" && (
          <div>
            <Label htmlFor="zoom">Zoom Link</Label>
            <Input id="zoom" value={zoomLink} onChange={(e) => setZoomLink(e.target.value)} placeholder="https://zoom.us/..." />
          </div>
        )}
        <div>
          <Label htmlFor="capacity">Capacity</Label>
          <Input id="capacity" type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} placeholder="Leave blank for unlimited" />
        </div>

        {/* Potluck Limits */}
        <div>
          <Label className="flex items-center gap-1.5 mb-2">
            <UtensilsCrossed className="h-4 w-4 text-primary" /> Potluck Limits
          </Label>
          <div className="grid grid-cols-2 gap-2">
            {POTLUCK_CATEGORIES.map((cat) => (
              <div key={cat} className="flex items-center gap-2">
                <Label className="w-16 text-xs capitalize text-muted-foreground">{cat}</Label>
                <Input
                  type="number"
                  min="0"
                  className="h-9"
                  value={potluckSlots[cat] ?? ""}
                  onChange={(e) => setPotluckSlots((s) => ({ ...s, [cat]: e.target.value }))}
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <Button
          className="w-full h-12"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !title || !dateTime}
        >
          {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {event ? "Update Event" : "Create Event"}
        </Button>
      </CardContent>
    </Card>
  );
}

function RSVPMonitor({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { data: rsvps, isLoading } = useQuery({
    queryKey: ["admin-rsvps", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*, profiles:user_id(name, email)")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg">RSVP Monitor</CardTitle>
        <Button size="icon" variant="ghost" className="h-10 w-10" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : rsvps && rsvps.length > 0 ? (
          <div className="space-y-2">
            {rsvps.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-card-foreground">
                    {r.profiles?.name || r.profiles?.email || "Unknown"}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">Guests: {r.guests_count}</span>
                    {r.potluck_category && (
                      <span className="text-xs text-muted-foreground capitalize">
                        🍽 {r.potluck_category}: {r.specific_food_item || "TBD"}
                      </span>
                    )}
                  </div>
                </div>
                <Badge variant={r.checked_in ? "default" : "outline"} className="text-xs">
                  {r.checked_in ? "✓ In" : "Not in"}
                </Badge>
              </div>
            ))}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Total attendees: {rsvps.reduce((sum: number, r: any) => sum + r.guests_count, 0)}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No RSVPs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
