import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP } from "@/hooks/useRSVP";
import EventCard from "@/components/EventCard";
import HostDashboard from "@/components/HostDashboard";
import QRTicketScreen from "@/components/QRTicketScreen";
import SelfCheckinModal from "@/components/SelfCheckinModal";
import { Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function EventDetail() {
  const { eventId } = useParams<{ eventId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  const actionParam = searchParams.get("action");
  const pinParam = searchParams.get("pin");

  const [showCheckin, setShowCheckin] = useState(false);
  const [ticketEvent, setTicketEvent] = useState<Event | null>(null);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: ["event-detail", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", eventId!)
        .single();
      if (error) throw error;
      return data as Event;
    },
  });

  const { data: myRSVP, isLoading: rsvpLoading } = useMyRSVP(eventId ?? "");

  // Auto-trigger check-in modal when arriving via QR deep link
  useEffect(() => {
    if (actionParam === "checkin" && pinParam && myRSVP && !myRSVP.checked_in) {
      setShowCheckin(true);
      // Clean up URL params
      setSearchParams({}, { replace: true });
    }
  }, [actionParam, pinParam, myRSVP, setSearchParams]);

  if (eventLoading || rsvpLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 py-8 text-center">
          <p className="text-muted-foreground">Event not found.</p>
          <Button variant="link" onClick={() => navigate("/")}>
            Go Home
          </Button>
        </div>
      </div>
    );
  }

  if (ticketEvent) {
    return <QRTicketScreen event={ticketEvent} rsvp={myRSVP!} onBack={() => setTicketEvent(null)} />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-4 py-4">
        <Button variant="ghost" size="sm" className="mb-3 gap-1.5" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <EventCard event={event} onShowTicket={(e) => setTicketEvent(e)} />

        {/* Host Dashboard — only visible to the assigned host */}
        {user && (event as any).host_id === user.id && (
          <div className="mt-4">
            <HostDashboard eventId={event.id} />
          </div>
        )}
      </div>

      {myRSVP && !myRSVP.checked_in && eventId && (
        <SelfCheckinModal
          open={showCheckin}
          onOpenChange={setShowCheckin}
          eventId={eventId}
          rsvpId={myRSVP.id}
          eventTitle={event.title}
          autoPin={pinParam ?? undefined}
        />
      )}
    </div>
  );
}
