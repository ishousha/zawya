import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScanLine, CheckCircle2, XOctagon, Users, Search, UserCheck, UserX, Radio, ClipboardList, CalendarClock } from "lucide-react";
import { toast } from "sonner";
import { Scanner } from "@yudiel/react-qr-scanner";

interface QRPayload {
  rsvp_id: string;
  user_id: string;
  qr_hash: string;
  event_id: string;
}

interface PromisedItem {
  name: string;
  quantity: number;
  description: string | null;
}

interface AttendeeRow {
  rsvp_id: string;
  checked_in: boolean;
  guests_count: number;
  name: string;
  user_id: string;
  promised: PromisedItem[];
}

export default function AdminDoorScanner() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string; promised?: PromisedItem[]; name?: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showManual, setShowManual] = useState(false);

  const { data: events } = useQuery({
    queryKey: ["admin-events-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, end_date_time")
        .in("status", ["active", "full"])
        .order("date_time", { ascending: true });
      if (error) throw error;
      // Exclude past events: keep events whose effective end is >= now
      const nowMs = Date.now();
      return (data ?? []).filter((e: any) => {
        const start = new Date(e.date_time).getTime();
        const end = e.end_date_time
          ? new Date(e.end_date_time).getTime()
          : start + 6 * 60 * 60 * 1000;
        return end >= nowMs;
      });
    },
  });

  // Detect currently-live event (now between start and effective end; +6h fallback)
  const liveEvent = useMemo(() => {
    if (!events?.length) return null;
    const nowMs = Date.now();
    return (
      events.find((e: any) => {
        const start = new Date(e.date_time).getTime();
        const end = e.end_date_time
          ? new Date(e.end_date_time).getTime()
          : start + 6 * 60 * 60 * 1000;
        return start <= nowMs && end >= nowMs;
      }) ?? null
    );
  }, [events]);

  // Next upcoming (future) event, excluding the live one
  const nextUpcomingEvent = useMemo(() => {
    if (!events?.length) return null;
    const nowMs = Date.now();
    const liveId = liveEvent?.id;
    return (
      events
        .filter((e: any) => e.id !== liveId && new Date(e.date_time).getTime() > nowMs)
        .sort((a: any, b: any) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime())[0] ?? null
    );
  }, [events, liveEvent]);

  // Sort: live events first, then by date
  const sortedEvents = useMemo(() => {
    if (!events) return [];
    const liveId = liveEvent?.id;
    return [...events].sort((a, b) => {
      if (a.id === liveId) return -1;
      if (b.id === liveId) return 1;
      return new Date(a.date_time).getTime() - new Date(b.date_time).getTime();
    });
  }, [events, liveEvent]);

  // Auto-select live event (or next upcoming) once on mount
  const autoSelected = useRef(false);
  useEffect(() => {
    if (autoSelected.current || selectedEventId) return;
    const target = liveEvent ?? nextUpcomingEvent;
    if (target) {
      setSelectedEventId(target.id);
      autoSelected.current = true;
    }
  }, [liveEvent, nextUpcomingEvent, selectedEventId]);

  // Honor explicit eventId from navigation state (Quick Action click)
  const location = useLocation();
  const navigate = useNavigate();
  useEffect(() => {
    const state = location.state as { tab?: string; eventId?: string } | null;
    if (state?.tab === "scanner" && state.eventId) {
      setSelectedEventId(state.eventId);
      autoSelected.current = true;
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  // Live check-in counter + attendee list for manual search
  const { data: attendees } = useQuery({
    queryKey: ["door-scanner-attendees", selectedEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, checked_in, guests_count, user_id")
        .eq("event_id", selectedEventId);
      if (error) throw error;

      // Fetch profile names
      const userIds = data.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p.name]) ?? []);

      return data.map((r) => ({
        rsvp_id: r.id,
        checked_in: r.checked_in,
        guests_count: r.guests_count,
        name: profileMap.get(r.user_id) || "Unknown",
        user_id: r.user_id,
      })) as AttendeeRow[];
    },
    enabled: !!selectedEventId,
    refetchInterval: 5000,
  });

  const rsvpCounts = useMemo(() => {
    if (!attendees) return null;
    const total = attendees.length;
    const totalGuests = attendees.reduce((sum, r) => sum + r.guests_count, 0);
    const checkedIn = attendees.filter((r) => r.checked_in).length;
    const checkedInGuests = attendees.filter((r) => r.checked_in).reduce((sum, r) => sum + r.guests_count, 0);
    return { total, totalGuests, checkedIn, checkedInGuests };
  }, [attendees]);

  const filteredAttendees = useMemo(() => {
    if (!attendees || !searchQuery.trim()) return attendees ?? [];
    const q = searchQuery.toLowerCase();
    return attendees.filter((a) => a.name.toLowerCase().includes(q));
  }, [attendees, searchQuery]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-rsvps"] });
    queryClient.invalidateQueries({ queryKey: ["door-scanner-attendees", selectedEventId] });
  };

  // Manual check-in mutation (by rsvp_id directly)
  const manualCheckIn = useMutation({
    mutationFn: async (attendee: AttendeeRow) => {
      if (attendee.checked_in) throw Object.assign(new Error("ALREADY_SCANNED"), { meta: { name: attendee.name } });
      const { error } = await supabase.from("rsvps").update({ checked_in: true }).eq("id", attendee.rsvp_id);
      if (error) throw error;
      return attendee;
    },
    onSuccess: (attendee) => {
      const guestText = attendee.guests_count > 1 ? ` +${attendee.guests_count - 1} guests` : "";
      setLastResult({ success: true, message: `✓ ${attendee.name} checked in${guestText}` });
      toast.success(`${attendee.name} checked in!`);
      playTone(800, 200);
      invalidateAll();
    },
    onError: (error: any) => {
      if (error.message === "ALREADY_SCANNED") {
        toast.error("Already checked in!", { description: `${error.meta?.name} was already checked in.` });
      } else {
        toast.error("Check-in failed");
      }
    },
  });

  // Undo / reverse check-in
  const undoCheckIn = useMutation({
    mutationFn: async (attendee: AttendeeRow) => {
      const { error } = await supabase.from("rsvps").update({ checked_in: false }).eq("id", attendee.rsvp_id);
      if (error) throw error;
      return attendee;
    },
    onSuccess: (attendee) => {
      setLastResult({ success: true, message: `↩ ${attendee.name} check-in reversed` });
      toast.success(`${attendee.name} check-in undone`);
      invalidateAll();
    },
    onError: () => {
      toast.error("Failed to undo check-in");
    },
  });

  const checkIn = useMutation({
    mutationFn: async (payload: QRPayload) => {
      const { data: rsvp, error: findError } = await supabase
        .from("rsvps")
        .select("id, checked_in, user_id, event_id, guests_count")
        .eq("id", payload.rsvp_id)
        .eq("qr_hash", payload.qr_hash)
        .maybeSingle();

      if (findError) throw findError;
      if (!rsvp) throw new Error("INVALID_TICKET");
      if (selectedEventId && rsvp.event_id !== selectedEventId) throw new Error("WRONG_EVENT");

      if (rsvp.checked_in) {
        const { data: profile } = await supabase.from("profiles").select("name").eq("id", rsvp.user_id).maybeSingle();
        throw Object.assign(new Error("ALREADY_SCANNED"), { meta: { name: profile?.name || "Attendee" } });
      }

      const { error: updateError } = await supabase.from("rsvps").update({ checked_in: true }).eq("id", rsvp.id);
      if (updateError) throw updateError;

      const { data: profile } = await supabase.from("profiles").select("name").eq("id", rsvp.user_id).maybeSingle();
      return { ...rsvp, profileName: profile?.name || "Attendee" };
    },
    onSuccess: (rsvp) => {
      const guestText = rsvp.guests_count > 1 ? ` +${rsvp.guests_count - 1} guests` : "";
      setLastResult({ success: true, message: `✓ ${rsvp.profileName} checked in${guestText}` });
      toast.success(`${rsvp.profileName} checked in!`);
      playTone(800, 200);
      invalidateAll();
    },
    onError: (error: any) => {
      let message = "Unknown error";
      if (error.message === "ALREADY_SCANNED") {
        const name = error.meta?.name || "Attendee";
        message = `⚠ ALREADY SCANNED — ${name} was already checked in`;
        toast.error("Already scanned!", { description: `${name} has already been checked in.` });
        playTone(200, 500);
      } else if (error.message === "INVALID_TICKET") {
        message = "✗ Invalid ticket — QR code not recognized";
        toast.error("Invalid ticket!");
        playTone(200, 500);
      } else if (error.message === "WRONG_EVENT") {
        message = "✗ Wrong event — This ticket is for a different gathering";
        toast.error("Wrong event!");
        playTone(200, 500);
      }
      setLastResult({ success: false, message });
    },
  });

  const handleScan = useCallback(
    (result: any) => {
      if (result?.[0]?.rawValue && !checkIn.isPending) {
        const raw = result[0].rawValue;
        setScanning(false);
        try {
          const payload: QRPayload = JSON.parse(raw);
          if (!payload.rsvp_id || !payload.qr_hash) throw new Error("Missing fields");
          checkIn.mutate(payload);
        } catch {
          setLastResult({ success: false, message: "✗ Could not read QR code — not a valid Zawya ticket" });
          toast.error("Not a Zawya ticket");
          playTone(200, 500);
        }
      }
    },
    [checkIn.isPending],
  );

  return (
    <div className="space-y-4 py-4">
      {/* LIVE NOW quick-pick */}
      {liveEvent && (
        <button
          type="button"
          onClick={() => { setSelectedEventId(liveEvent.id); setShowManual(false); setSearchQuery(""); }}
          className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
            selectedEventId === liveEvent.id
              ? "border-primary bg-primary/10"
              : "border-primary/40 bg-primary/5 hover:bg-primary/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Radio className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Live now</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium text-card-foreground">{liveEvent.title}</p>
              <p className="text-xs text-muted-foreground">
                Started {format(new Date(liveEvent.date_time), "h:mm a")}
              </p>
            </div>
            {selectedEventId === liveEvent.id && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            )}
          </div>
        </button>
      )}

      {/* UP NEXT quick-pick (only when nothing is live) */}
      {!liveEvent && nextUpcomingEvent && (
        <button
          type="button"
          onClick={() => { setSelectedEventId(nextUpcomingEvent.id); setShowManual(false); setSearchQuery(""); }}
          className={`w-full rounded-lg border-2 p-3 text-left transition-all ${
            selectedEventId === nextUpcomingEvent.id
              ? "border-primary bg-primary/10"
              : "border-primary/40 bg-primary/5 hover:bg-primary/10"
          }`}
        >
          <div className="flex items-center gap-3">
            <CalendarClock className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-primary">Up next</span>
              </div>
              <p className="mt-0.5 truncate text-sm font-medium text-card-foreground">{nextUpcomingEvent.title}</p>
              <p className="text-xs text-muted-foreground">
                Starts {format(new Date(nextUpcomingEvent.date_time), "EEE, MMM d · h:mm a")}
              </p>
            </div>
            {selectedEventId === nextUpcomingEvent.id && (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
            )}
          </div>
        </button>
      )}

      {/* Event selector */}
      {sortedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
          <p className="text-sm text-muted-foreground">No current or upcoming events to check in.</p>
        </div>
      ) : (
        <div>
          <Label>Select Event</Label>
          <Select value={selectedEventId} onValueChange={(v) => { setSelectedEventId(v); setShowManual(false); setSearchQuery(""); }}>
            <SelectTrigger className="h-12">
              <SelectValue placeholder="Choose an event..." />
            </SelectTrigger>
            <SelectContent>
              {sortedEvents.map((e) => {
                const isLive = liveEvent?.id === e.id;
                return (
                  <SelectItem key={e.id} value={e.id}>
                    <span className="flex items-center gap-2">
                      {isLive && (
                        <Badge variant="default" className="h-5 px-1.5 text-[10px] font-bold uppercase">
                          Live
                        </Badge>
                      )}
                      <span>{e.title} — {format(new Date(e.date_time), "EEE, MMM d")}</span>
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Live check-in counter */}
      {selectedEventId && rsvpCounts && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium text-card-foreground">
                <Users className="h-4 w-4 text-primary" />
                Check-in Progress
              </div>
              <span className="text-2xl font-bold text-primary">
                {rsvpCounts.checkedInGuests}/{rsvpCounts.totalGuests}
              </span>
            </div>
            <Progress
              value={rsvpCounts.totalGuests > 0 ? (rsvpCounts.checkedInGuests / rsvpCounts.totalGuests) * 100 : 0}
              className="h-3"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{rsvpCounts.checkedInGuests} of {rsvpCounts.totalGuests} total guests arrived</span>
              <span>{rsvpCounts.totalGuests - rsvpCounts.checkedInGuests} remaining</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => navigate("/admin", { state: { tab: "events", eventId: selectedEventId } })}
            >
              <ClipboardList className="h-4 w-4" />
              View Guest List
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Scanner + Manual toggle */}
      {selectedEventId && (
        <div className="flex gap-2">
          {!scanning ? (
            <Button
              className="flex-1 h-14 gap-2 text-base"
              onClick={() => { setScanning(true); setLastResult(null); setShowManual(false); }}
            >
              <ScanLine className="h-5 w-5" />
              Scan QR
            </Button>
          ) : (
            <Card className="w-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center justify-between">
                  Scanning...
                  <Button size="sm" variant="outline" onClick={() => setScanning(false)}>Stop</Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-hidden rounded-lg">
                  <Scanner
                    onScan={handleScan}
                    constraints={{ facingMode: "environment" }}
                    styles={{ container: { width: "100%" } }}
                  />
                </div>
              </CardContent>
            </Card>
          )}
          {!scanning && (
            <Button
              variant={showManual ? "default" : "outline"}
              className="flex-1 h-14 gap-2 text-base"
              onClick={() => { setShowManual(!showManual); setLastResult(null); }}
            >
              <Search className="h-5 w-5" />
              Search Name
            </Button>
          )}
        </div>
      )}

      {/* Manual search panel */}
      {showManual && selectedEventId && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Manual Check-in</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11"
                autoFocus
              />
            </div>

            <div className="max-h-64 overflow-y-auto space-y-1">
              {filteredAttendees.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  {searchQuery ? "No attendees match your search" : "No RSVPs for this event"}
                </p>
              ) : (
                filteredAttendees.map((attendee) => (
                  <div
                    key={attendee.rsvp_id}
                    className="flex items-center justify-between rounded-lg border border-border p-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {attendee.checked_in ? (
                        <UserCheck className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <UserX className="h-4 w-4 shrink-0 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">{attendee.name}</p>
                        {attendee.guests_count > 1 && (
                          <p className="text-xs text-muted-foreground">+{attendee.guests_count - 1} guests</p>
                        )}
                      </div>
                    </div>
                    {attendee.checked_in ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge variant="secondary" className="text-xs">Checked in</Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                          onClick={() => undoCheckIn.mutate(attendee)}
                          disabled={undoCheckIn.isPending}
                        >
                          Undo
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => manualCheckIn.mutate(attendee)}
                        disabled={manualCheckIn.isPending}
                        className="shrink-0"
                      >
                        Check in
                      </Button>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Result display */}
      {lastResult && (
        <Card className={lastResult.success ? "border-primary" : "border-destructive"}>
          <CardContent className="flex items-center gap-3 p-4">
            {lastResult.success ? (
              <CheckCircle2 className="h-8 w-8 shrink-0 text-primary" />
            ) : (
              <XOctagon className="h-8 w-8 shrink-0 text-destructive" />
            )}
            <p className={`text-sm font-medium ${lastResult.success ? "text-primary" : "text-destructive"}`}>
              {lastResult.message}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Scan another */}
      {lastResult && !scanning && !showManual && (
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => { setScanning(true); setLastResult(null); }}
        >
          Scan Next Ticket
        </Button>
      )}
    </div>
  );
}

/** Simple beep using Web Audio API */
function playTone(frequency: number, duration: number) {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = frequency;
    gain.gain.value = 0.3;
    osc.start();
    osc.stop(ctx.currentTime + duration / 1000);
  } catch {
    // Audio not available
  }
}
