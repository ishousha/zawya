import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EVENT_PUBLIC_COLUMNS } from "@/lib/event-columns";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP } from "@/hooks/useRSVP";
import EventCard from "@/components/EventCard";
import HostDashboard from "@/components/HostDashboard";
import QRTicketScreen from "@/components/QRTicketScreen";
import SelfCheckinModal from "@/components/SelfCheckinModal";
import ContactOrganizerModal from "@/components/ContactOrganizerModal";
import FeaturedSpeakers from "@/components/FeaturedSpeaker";
import { Loader2, ArrowLeft, Mail, Clock, ScrollText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { useShareEvent } from "@/components/ShareEventDialog";
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
  const [showContact, setShowContact] = useState(false);
  const { open: openShare, dialog: shareDialog } = useShareEvent();

  const { data: event, isLoading: eventLoading, isError: eventError } = useQuery({
    queryKey: ["event-detail", eventId],
    enabled: !!eventId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_PUBLIC_COLUMNS)
        .eq("id", eventId!)
        .maybeSingle();
      if (error) throw error;
      return data as Event | null;
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

  // Graceful 404 fallback — event missing or not visible to user
  useEffect(() => {
    if (!eventLoading && (eventError || (eventId && event === null))) {
      toast.error("This event could not be found or has been removed.");
      navigate("/", { replace: true });
    }
  }, [eventLoading, eventError, event, eventId, navigate]);

  if (eventLoading || rsvpLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
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

        {new Date(event.end_date_time ?? event.date_time) <= new Date() && event.status !== "cancelled" && (
          <div className="mb-3 flex items-center gap-2 rounded-lg border border-muted bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0" />
            This event has ended
          </div>
        )}

        <EventCard event={event} onShowTicket={(e) => setTicketEvent(e)} />

        {/* Featured Speakers */}
        <FeaturedSpeakers eventId={event.id} />

        {/* Gathering Etiquette (Adab) */}
        <GatheringEtiquette event={event} />

        {/* Contact Organizer button — visible for upcoming, non-cancelled events */}
        {user && event.status !== "cancelled" && new Date(event.end_date_time ?? event.date_time) > new Date() && (
          <div className="mt-3">
            <Button
              variant="secondary"
              className="w-full gap-2"
              onClick={() => setShowContact(true)}
            >
              <Mail className="h-4 w-4" />
              Contact Organizer
            </Button>
          </div>
        )}

        {/* Share / Copy Link — visible to admins, moderators, and assigned host */}
        {user && (
          profile?.role === "admin" ||
          profile?.role === "moderator" ||
          (event as any).host_id === user.id
        ) && (
          <div className="mt-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => openShare(event.id, event.title, (event as any).short_code)}
            >
              <Share2 className="h-4 w-4" />
              Share Event
            </Button>
          </div>
        )}
        {shareDialog}

        {/* Host Dashboard — visible to assigned host, admins, and moderators */}
        {user && (
          (event as any).host_id === user.id ||
          profile?.role === "admin" ||
          profile?.role === "moderator"
        ) && (
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

      <ContactOrganizerModal
        open={showContact}
        onOpenChange={setShowContact}
        eventId={event.id}
        eventTitle={event.title}
      />
    </div>
  );
}

const DEFAULT_ETIQUETTE = [
  "Please arrive on time to respect everyone's schedule",
  "Keep phones on silent during the gathering",
  "Park responsibly and be mindful of neighbors",
  "Help with clean-up before you leave",
];

function GatheringEtiquette({ event }: { event: Event }) {
  const customNotes = (event as any).etiquette_notes as string | null;
  const hasCustom = !!customNotes?.trim();

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-2">
        <ScrollText className="h-4 w-4 text-primary" />
        <h3 className="font-heading text-sm font-semibold text-foreground">Gathering Etiquette</h3>
      </div>
      {hasCustom ? (
        <p className="text-sm text-muted-foreground whitespace-pre-line">{customNotes}</p>
      ) : (
        <ul className="space-y-1.5">
          {DEFAULT_ETIQUETTE.map((rule, i) => (
            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              {rule}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
