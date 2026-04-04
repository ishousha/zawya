import { QRCodeSVG } from "qrcode.react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type Event = Database["public"]["Tables"]["events"]["Row"];

interface QRTicketScreenProps {
  event: Event;
  rsvp: RSVP;
  onBack: () => void;
}

export default function QRTicketScreen({ event, rsvp, onBack }: QRTicketScreenProps) {
  const localDate = new Date(event.date_time);
  const qrData = JSON.stringify({
    rsvp_id: rsvp.id,
    qr_hash: rsvp.qr_hash,
    event_id: event.id,
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="mb-2 -ml-2">
          <ArrowLeft className="mr-1 h-4 w-4" /> Back
        </Button>
        <h1 className="font-heading text-2xl font-bold text-foreground">Your Ticket</h1>
      </header>

      <main className="mx-auto max-w-sm px-4 py-6">
        <div className="animate-fade-in overflow-hidden rounded-xl border border-border bg-card">
          {/* Ticket top */}
          <div className="bg-primary px-6 py-4 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-primary-foreground" />
            <h2 className="font-heading text-lg font-bold text-primary-foreground">
              {event.title}
            </h2>
            <p className="mt-1 text-sm text-primary-foreground/80">
              {format(localDate, "EEEE, MMMM d · h:mm a")}
            </p>
          </div>

          {/* Dashed divider */}
          <div className="relative">
            <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-background" />
            <div className="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-background" />
            <div className="border-t-2 border-dashed border-border" />
          </div>

          {/* QR Code */}
          <div className="flex flex-col items-center px-6 py-6">
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
          </div>

          {/* Details */}
          <div className="border-t border-border px-6 py-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Guests</span>
              <span className="font-medium text-card-foreground">{rsvp.guests_count}</span>
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
            {event.zoom_link && (
              <div className="mt-2">
                <span className="text-muted-foreground">Zoom: </span>
                <a
                  href={event.zoom_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2"
                >
                  Join Meeting
                </a>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
