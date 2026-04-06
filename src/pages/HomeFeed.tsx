import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP } from "@/hooks/useRSVP";
import EventCard from "@/components/EventCard";
import QRTicketScreen from "@/components/QRTicketScreen";
import InstallAppBanner from "@/components/InstallAppBanner";
import { Loader2 } from "lucide-react";
import { cacheTicket, getCachedTicketByEvent, cleanExpiredTickets } from "@/lib/offline-ticket-cache";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function HomeFeed() {
  const { profile } = useAuth();
  const [ticketEvent, setTicketEvent] = useState<Event | null>(null);

  // Clean expired tickets on mount
  useEffect(() => {
    cleanExpiredTickets();
  }, []);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["active", "full", "cancelled"])
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // If viewing a ticket, show QR screen
  if (ticketEvent) {
    return (
      <TicketView event={ticketEvent} onBack={() => setTicketEvent(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Zawya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back{profile?.name ? `, ${profile.name}` : ""}
        </p>
      </header>

      <InstallAppBanner />

      <main className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
          Upcoming Activities
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onShowTicket={(e) => setTicketEvent(e)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No upcoming activities scheduled.</p>
          </div>
        )}
      </main>
    </div>
  );
}

/** Wrapper that loads RSVP data (with offline fallback) for the ticket screen */
function TicketView({ event, onBack }: { event: Event; onBack: () => void }) {
  const { profile } = useAuth();
  const { data: myRSVP, isLoading, isError } = useMyRSVP(event.id);

  // When RSVP loads successfully, cache the ticket
  useEffect(() => {
    if (myRSVP && profile?.name) {
      cacheTicket(myRSVP, event, profile.name);
    }
  }, [myRSVP, event, profile?.name]);

  // No RSVP at all — navigate back (must be a hook, not a side-effect in render)
  useEffect(() => {
    if (!isLoading && !myRSVP && !isError) {
      onBack();
    }
  }, [isLoading, myRSVP, isError, onBack]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Online and have RSVP
  if (myRSVP) {
    return <QRTicketScreen event={event} rsvp={myRSVP} onBack={onBack} />;
  }

  // No RSVP from network — try offline cache
  const cached = getCachedTicketByEvent(event.id);
  if (cached) {
    return (
      <QRTicketScreen
        event={cached.event}
        rsvp={cached.rsvp}
        profileName={cached.profileName}
        isOffline
        onBack={onBack}
      />
    );
  }

  // Fallback while the useEffect navigates back
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
