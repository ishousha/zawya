import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, ScanLine, CheckCircle2, XOctagon } from "lucide-react";
import { toast } from "sonner";
import { Scanner } from "@yudiel/react-qr-scanner";

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
        .eq("status", "active")
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const checkIn = useMutation({
    mutationFn: async (qrHash: string) => {
      // Find the RSVP by qr_hash
      const { data: rsvp, error: findError } = await supabase
        .from("rsvps")
        .select("id, checked_in, user_id, event_id, guests_count, profiles:user_id(name)")
        .eq("qr_hash", qrHash)
        .maybeSingle();

      if (findError) throw findError;
      if (!rsvp) throw new Error("INVALID_TICKET");

      if (selectedEventId && rsvp.event_id !== selectedEventId) {
        throw new Error("WRONG_EVENT");
      }

      if (rsvp.checked_in) {
        throw new Error("ALREADY_SCANNED");
      }

      // Mark as checked in
      const { error: updateError } = await supabase
        .from("rsvps")
        .update({ checked_in: true })
        .eq("id", rsvp.id);

      if (updateError) throw updateError;

      return rsvp;
    },
    onSuccess: (rsvp: any) => {
      const name = rsvp.profiles?.name || "Attendee";
      setLastResult({ success: true, message: `✓ ${name} checked in (${rsvp.guests_count} guests)` });
      toast.success(`${name} checked in!`, { duration: 3000 });
      // Play success sound
      playTone(800, 200);
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps"] });
    },
    onError: (error: Error) => {
      let message = "Unknown error";
      if (error.message === "ALREADY_SCANNED") {
        message = "⚠ ALREADY SCANNED — This ticket has been used!";
        toast.error("ALREADY SCANNED!", { 
          description: "This ticket has already been used.",
          duration: 5000,
          style: { background: "hsl(var(--destructive))", color: "hsl(var(--destructive-foreground))" },
        });
        playTone(200, 500);
      } else if (error.message === "INVALID_TICKET") {
        message = "✗ Invalid ticket — QR code not found";
        toast.error("Invalid ticket!", { duration: 4000 });
        playTone(200, 500);
      } else if (error.message === "WRONG_EVENT") {
        message = "✗ Wrong event — This ticket is for a different gathering";
        toast.error("Wrong event!", { duration: 4000 });
        playTone(200, 500);
      }
      setLastResult({ success: false, message });
    },
  });

  const handleScan = useCallback(
    (result: any) => {
      if (result?.[0]?.rawValue && !checkIn.isPending) {
        const qrData = result[0].rawValue;
        setScanning(false);
        checkIn.mutate(qrData);
      }
    },
    [checkIn.isPending]
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
              <SelectItem key={e.id} value={e.id}>{e.title}</SelectItem>
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
