import { useRef, useState, useCallback } from "react";
import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Download, Loader2, WifiOff, ScanLine } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];

interface QRTicketScreenProps {
  event: Event;
  rsvp: RSVP;
  profileName?: string;
  isOffline?: boolean;
  onBack: () => void;
}

export default function QRTicketScreen({ event, rsvp, profileName, isOffline, onBack }: QRTicketScreenProps) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const ticketRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [checkinSuccess, setCheckinSuccess] = useState(rsvp.checked_in);
  const localDate = new Date(event.date_time);
  const displayName = profileName || profile?.name || "Member";

  const qrData = JSON.stringify({
    rsvp_id: rsvp.id,
    user_id: rsvp.user_id,
    qr_hash: rsvp.qr_hash,
    event_id: event.id,
  });

  const handleSaveImage = async () => {
    if (!ticketRef.current) return;
    setSaving(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(ticketRef.current, {
        backgroundColor: null,
        scale: 3,
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `zawya-ticket-${event.title.replace(/\s+/g, "-").toLowerCase()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (e) {
      console.error("Failed to save ticket image", e);
    } finally {
      setSaving(false);
    }
  };

  const handleScanResult = useCallback(async (scannedText: string) => {
    // Extract checkin PIN from the scanned QR URL
    try {
      const url = new URL(scannedText);
      const action = url.searchParams.get("action");
      const pin = url.searchParams.get("pin");

      if (action !== "checkin" || !pin) {
        toast.error("Invalid QR code. Please scan the check-in poster.");
        return;
      }

      // Validate PIN against event
      const { data: eventData, error: fetchErr } = await supabase
        .from("events")
        .select("checkin_pin")
        .eq("id", event.id)
        .single();

      if (fetchErr || !eventData) {
        toast.error("Could not verify PIN.");
        return;
      }

      if ((eventData as any).checkin_pin !== pin) {
        toast.error("PIN mismatch. Make sure you're scanning the correct event poster.");
        return;
      }

      // Check in
      const { error: updateErr } = await supabase
        .from("rsvps")
        .update({ checked_in: true })
        .eq("id", rsvp.id);

      if (updateErr) {
        toast.error("Failed to check in.");
        return;
      }

      setCheckinSuccess(true);
      setScanning(false);
      queryClient.invalidateQueries({ queryKey: ["my-rsvp"] });
      queryClient.invalidateQueries({ queryKey: ["rsvps"] });
      toast.success("You're checked in! 🎉");
    } catch {
      toast.error("Could not read QR code. Please try the poster QR code.");
    }
  }, [event.id, rsvp.id, queryClient]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="font-heading text-2xl font-bold text-foreground">Your Ticket</h1>
        {isOffline && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
            <WifiOff className="h-3.5 w-3.5" />
            Showing cached ticket — you're offline
          </p>
        )}
      </header>

      <main className="mx-auto max-w-sm px-4 py-6">
        {/* Scanner overlay */}
        {scanning && (
          <ScannerView
            onResult={handleScanResult}
            onClose={() => setScanning(false)}
          />
        )}

        {/* Ticket card — captured for save */}
        <div ref={ticketRef} className="animate-fade-in overflow-hidden rounded-xl border border-border bg-card">
          {/* Ticket top */}
          <div className="bg-primary px-6 py-5 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary-foreground" />
            <h2 className="font-heading text-lg font-bold text-primary-foreground">
              {event.title}
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {format(localDate, "EEEE, MMMM d · h:mm a")}
            </p>
          </div>

          {/* Dashed divider with notch */}
          <div className="relative">
            <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-background" />
            <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-background" />
            <div className="border-t-2 border-dashed border-border" />
          </div>

          {/* Member name */}
          <div className="px-6 pt-5 text-center">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Attendee</p>
            <p className="mt-1 font-heading text-lg font-semibold text-card-foreground">
              {displayName}
            </p>
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center px-6 py-5">
            {checkinSuccess ? (
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 className="h-16 w-16 text-primary animate-bounce" />
                <p className="text-lg font-semibold text-primary">Checked In ✓</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg bg-background p-3">
                  <QRCodeSVG
                    value={qrData}
                    size={180}
                    level="H"
                    bgColor="transparent"
                    fgColor="hsl(153, 40%, 28%)"
                  />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Show this QR code at the door
                </p>
              </>
            )}
          </div>

          {/* Details */}
          <div className="border-t border-border px-6 py-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guests</span>
              <span className="font-medium text-card-foreground">
                {rsvp.guests_count > 1 ? `+${rsvp.guests_count - 1}` : "Just you"}
              </span>
            </div>
            {rsvp.potluck_category && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Bringing</span>
                <span className="font-medium text-card-foreground capitalize">
                  {rsvp.specific_food_item || rsvp.potluck_category}
                </span>
              </div>
            )}
            {event.location && (
              <div className="mt-2 flex justify-between">
                <span className="text-muted-foreground">Location</span>
                <span className="font-medium text-card-foreground">{event.location}</span>
              </div>
            )}
            {(event.ticket_fee ?? 0) > 0 && (
              <div className="mt-3 rounded-md bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-500/40 p-2.5 text-center">
                <span className="text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                  💰 Pay Offline — {event.ticket_fee} AED
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 space-y-2">
          {!checkinSuccess && !isOffline && (
            <Button
              onClick={() => setScanning(true)}
              className="w-full gap-2"
            >
              <ScanLine className="h-4 w-4" />
              Scan Poster to Check In
            </Button>
          )}

          <Button
            onClick={handleSaveImage}
            disabled={saving}
            className="w-full gap-2"
            variant="outline"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Save Ticket as Image
          </Button>
        </div>
      </main>
    </div>
  );
}

/** Inline QR scanner using the camera */
function ScannerView({ onResult, onClose }: { onResult: (text: string) => void; onClose: () => void }) {
  const [error, setError] = useState("");
  const hasScanned = useRef(false);
  const [ScannerComp, setScannerComp] = useState<any>(null);

  // Lazy-load scanner component
  useState(() => {
    import("@yudiel/react-qr-scanner").then((mod) => {
      setScannerComp(() => mod.Scanner);
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-4 py-3">
        <p className="text-sm font-medium text-white">Scan the check-in poster QR code</p>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="flex-1 flex items-center justify-center px-8">
        <div className="w-full max-w-sm overflow-hidden rounded-xl">
          {ScannerComp ? (
            <ScannerComp
              onScan={(result: any) => {
                if (hasScanned.current) return;
                const text = result?.[0]?.rawValue;
                if (text) {
                  hasScanned.current = true;
                  onResult(text);
                }
              }}
              onError={(err: any) => {
                setError("Camera access denied. Please allow camera permissions.");
                console.error("Scanner error:", err);
              }}
              styles={{ container: { width: "100%" } }}
              scanDelay={300}
            />
          ) : (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
      </div>
      {error && (
        <p className="px-4 py-3 text-center text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
