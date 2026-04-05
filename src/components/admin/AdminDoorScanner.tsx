import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { ScanLine, CheckCircle2, XOctagon, Users } from "lucide-react";
import { toast } from "sonner";
import { Scanner } from "@yudiel/react-qr-scanner";

interface QRPayload {
  rsvp_id: string;
  user_id: string;
  qr_hash: string;
  event_id: string;
}

export default function AdminDoorScanner() {
  const queryClient = useQueryClient();
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: events } = useQuery({
    queryKey: ["admin-events-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time")
        .in("status", ["active", "full"])
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Live check-in counter
  const { data: rsvpCounts } = useQuery({
    queryKey: ["door-scanner-counts", selectedEventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("checked_in, guests_count")
        .eq("event_id", selectedEventId);
      if (error) throw error;
      const total = data.length;
      const totalGuests = data.reduce((sum, r) => sum + r.guests_count, 0);
      const checkedIn = data.filter((r) => r.checked_in).length;
      const checkedInGuests = data.filter((r) => r.checked_in).reduce((sum, r) => sum + r.guests_count, 0);
      return { total, totalGuests, checkedIn, checkedInGuests };
    },
    enabled: !!selectedEventId,
    refetchInterval: 5000,
  });

  const checkIn = useMutation({
    mutationFn: async (payload: QRPayload) => {
      // Verify the RSVP exists with matching qr_hash
      const { data: rsvp, error: findError } = await supabase
        .from("rsvps")
        .select("id, checked_in, user_id, event_id, guests_count")
        .eq("id", payload.rsvp_id)
        .eq("qr_hash", payload.qr_hash)
        .maybeSingle();

      if (findError) throw findError;
      if (!rsvp) throw new Error("INVALID_TICKET");

      if (selectedEventId && rsvp.event_id !== selectedEventId) {
        throw new Error("WRONG_EVENT");
      }

      if (rsvp.checked_in) {
        // Fetch name for the already-scanned message
        const { data: profile } = await supabase
          .from("profiles")
          .select("name")
          .eq("id", rsvp.user_id)
          .maybeSingle();
        throw Object.assign(new Error("ALREADY_SCANNED"), {
          meta: { name: profile?.name || "Attendee", guests: rsvp.guests_count },
        });
      }

      // Mark as checked in
      const { error: updateError } = await supabase
        .from("rsvps")
        .update({ checked_in: true })
        .eq("id", rsvp.id);

      if (updateError) throw updateError;

      // Fetch profile name
      const { data: profile } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", rsvp.user_id)
        .maybeSingle();

      return { ...rsvp, profileName: profile?.name || "Attendee" };
    },
    onSuccess: (rsvp) => {
      const guestText = rsvp.guests_count > 1 ? ` +${rsvp.guests_count - 1} guests` : "";
      setLastResult({ success: true, message: `✓ ${rsvp.profileName} checked in${guestText}` });
      toast.success(`${rsvp.profileName} checked in!`);
      playTone(800, 200);
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps"] });
      queryClient.invalidateQueries({ queryKey: ["door-scanner-counts", selectedEventId] });
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
      } else if (error.message === "PARSE_ERROR") {
        message = "✗ Could not read QR code — not a valid Zawya ticket";
        toast.error("Not a Zawya ticket");
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

        // Parse the QR JSON payload
        try {
          const payload: QRPayload = JSON.parse(raw);
          if (!payload.rsvp_id || !payload.qr_hash) {
            throw new Error("Missing fields");
          }
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
      {/* Event selector */}
      <div>
        <Label>Select Event</Label>
        <Select value={selectedEventId} onValueChange={setSelectedEventId}>
          <SelectTrigger className="h-12">
            <SelectValue placeholder="Choose an event..." />
          </SelectTrigger>
          <SelectContent>
            {events?.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scanner area */}
      {!scanning ? (
        <Button
          className="w-full h-14 gap-2 text-base"
          onClick={() => {
            setScanning(true);
            setLastResult(null);
          }}
          disabled={!selectedEventId}
        >
          <ScanLine className="h-5 w-5" />
          Start Scanning
        </Button>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center justify-between">
              Scanning...
              <Button size="sm" variant="outline" onClick={() => setScanning(false)}>
                Stop
              </Button>
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
      {lastResult && !scanning && (
        <Button
          variant="outline"
          className="w-full h-12"
          onClick={() => {
            setScanning(true);
            setLastResult(null);
          }}
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
