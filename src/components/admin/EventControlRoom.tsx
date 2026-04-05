import { useState } from "react";
import AdminGuestApprovals from "./AdminGuestApprovals";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Edit2, X, Users } from "lucide-react";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import EventFormTabs from "./event-form/EventFormTabs";

type EventRow = Database["public"]["Tables"]["events"]["Row"];

export default function EventControlRoom() {
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
        <EventFormTabs onClose={() => setCreating(false)} />
      )}

      {editing && (
        <EventFormTabs event={editing} onClose={() => setEditing(null)} />
      )}

      {monitoringEventId && (
        <RSVPMonitor eventId={monitoringEventId} onClose={() => setMonitoringEventId(null)} />
      )}
    </div>
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

  const attending = rsvps?.filter((r: any) => !r.is_waitlisted) ?? [];
  const waitlisted = rsvps?.filter((r: any) => r.is_waitlisted) ?? [];

  const formatAttendee = (r: any) => {
    const name = r.profiles?.name || r.profiles?.email || "Unknown";
    const kids = r.guests_count - 1;
    if (kids > 0) return `${name} + ${kids} kid${kids > 1 ? "s" : ""}`;
    return name;
  };

  const renderRow = (r: any) => (
    <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-card-foreground">
          {formatAttendee(r)}
        </p>
      </div>
      <Badge variant={r.checked_in ? "default" : "outline"} className="text-xs">
        {r.checked_in ? "✓ In" : "Not in"}
      </Badge>
    </div>
  );

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
          <div className="space-y-4">
            {/* Attending section */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Attending ({attending.length})
              </p>
              {attending.length > 0 ? (
                <div className="space-y-2">{attending.map(renderRow)}</div>
              ) : (
                <p className="text-xs text-muted-foreground italic">No confirmed attendees yet.</p>
              )}
            </div>

            {/* Waitlisted section */}
            {waitlisted.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
                  Waitlisted ({waitlisted.length})
                </p>
                <div className="space-y-2">{waitlisted.map(renderRow)}</div>
              </div>
            )}

            {/* Guest Approvals */}
            <div className="pt-2 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Guest Requests
              </p>
              <AdminGuestApprovals eventId={eventId} />
            </div>

            <p className="text-xs text-muted-foreground text-center pt-2">
              Total: {attending.reduce((s: number, r: any) => s + r.guests_count, 0)} attending
              {waitlisted.length > 0 && ` · ${waitlisted.reduce((s: number, r: any) => s + r.guests_count, 0)} waitlisted`}
            </p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No RSVPs yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
