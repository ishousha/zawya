import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP } from "@/hooks/useRSVP";
import { useBatchEventRSVPs, useBatchEventSpeakers, useBatchPotluckDishes } from "@/hooks/useBatchRSVPs";
import EventCard from "@/components/EventCard";
import QRTicketScreen from "@/components/QRTicketScreen";
import InstallAppBanner from "@/components/InstallAppBanner";
import { Loader2 } from "lucide-react";
import { cacheTicket, getCachedTicketByEvent, cleanExpiredTickets } from "@/lib/offline-ticket-cache";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function HomeFeed() {
  const { profile, user } = useAuth();
  const [ticketEvent, setTicketEvent] = useState<Event | null>(null);

  // Clean expired tickets on mount
  useEffect(() => {
    cleanExpiredTickets();
  }, []);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date().toISOString();
      const fallbackCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["active", "full", "cancelled"])
        .or(`end_date_time.gte.${now},and(end_date_time.is.null,date_time.gte.${fallbackCutoff})`)
        .order("date_time", { ascending: true })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";
  const isMureed = (profile as any)?.is_mureed ?? false;

  const visibleEvents = useMemo(() => events?.filter((e) => {
    if ((e as any).mureeds_only === true && !isMureed && !isAdminOrMod) return false;
    return true;
  }), [events, isMureed, isAdminOrMod]);

  const eventIds = useMemo(() => visibleEvents?.map((e) => e.id) ?? [], [visibleEvents]);

  // Batch queries: 3 requests instead of N*4
  const { data: batchRsvps } = useBatchEventRSVPs(eventIds);
  const { data: batchSpeakers } = useBatchEventSpeakers(eventIds);

  // Only fetch potluck dishes for events that have potluck
  const potluckEventIds = useMemo(
    () => visibleEvents?.filter((e) => e.has_potluck && e.status !== "cancelled").map((e) => e.id) ?? [],
    [visibleEvents]
  );
  const { data: batchDishes } = useBatchPotluckDishes(potluckEventIds);

  // Derive my RSVPs from the batch data
  const myRsvpMap = useMemo(() => {
    if (!batchRsvps || !user) return {};
    const map: Record<string, any> = {};
    for (const [eventId, rsvps] of Object.entries(batchRsvps)) {
      const mine = rsvps.find((r) => r.user_id === user.id && r.status !== "cancelled");
      if (mine) map[eventId] = mine;
    }
    return map;
  }, [batchRsvps, user]);

  // If viewing a ticket, show QR screen
  if (ticketEvent) {
    return (
      <TicketView event={ticketEvent} onBack={() => setTicketEvent(null)} />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <InstallAppBanner />

      <main className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
          Upcoming Activities
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : visibleEvents && visibleEvents.length > 0 ? (
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onShowTicket={(e) => setTicketEvent(e)}
                myRSVP={myRsvpMap[event.id] ?? null}
                allRsvps={batchRsvps?.[event.id] ?? []}
                speakers={batchSpeakers?.[event.id] ?? []}
                potluckDishes={batchDishes?.[event.id] ?? []}
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

  if (myRSVP) {
    return <QRTicketScreen event={event} rsvp={myRSVP} onBack={onBack} />;
  }

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}
