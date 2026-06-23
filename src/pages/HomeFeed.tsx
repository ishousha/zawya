import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { EVENT_PUBLIC_COLUMNS } from "@/lib/event-columns";
import { useAuth } from "@/contexts/AuthContext";
import { useMyRSVP, useMyEventCoverage } from "@/hooks/useRSVP";
import EventCard from "@/components/EventCard";
import { useBatchMyGuestRequests } from "@/hooks/useGuestRequests";
import QRTicketScreen from "@/components/QRTicketScreen";
import InstallAppBanner from "@/components/InstallAppBanner";
import { AdminDashboardSummary, MemberDashboardSummary } from "@/components/HomeDashboard";
import AdminQuickActions from "@/components/AdminQuickActions";
import { Loader2 } from "lucide-react";
import EventCardSkeleton from "@/components/EventCardSkeleton";
import { cacheTicket, getCachedTicketByEvent, cleanExpiredTickets } from "@/lib/offline-ticket-cache";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

export default function HomeFeed() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const [ticketEvent, setTicketEvent] = useState<Event | null>(null);
  const [tab, setTab] = useState<"upcoming" | "past">("upcoming");
  const handleShowTicket = useCallback((e: Event) => setTicketEvent(e), []);

  useEffect(() => {
    cleanExpiredTickets();
  }, []);

  const { data: events, isLoading } = useQuery({
    queryKey: ["events", tab],
    staleTime: 60_000,
    queryFn: async () => {
      // Keep events visible for 60 minutes past their end so late arrivals can still check in.
      const graceCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

      if (tab === "past") {
        const { data, error } = await supabase
          .from("events")
          .select(EVENT_PUBLIC_COLUMNS)
          .in("status", ["active", "full", "cancelled"])
          .or(`end_date_time.lt.${graceCutoff},and(end_date_time.is.null,date_time.lt.${graceCutoff})`)
          .order("date_time", { ascending: false })
          .limit(20);
        if (error) throw error;
        return data as unknown as Event[];
      }

      const { data, error } = await supabase
        .from("events")
        .select(EVENT_PUBLIC_COLUMNS)
        .in("status", ["active", "full", "cancelled"])
        .or(`end_date_time.gte.${graceCutoff},and(end_date_time.is.null,date_time.gte.${graceCutoff})`)
        .order("date_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data as unknown as Event[];
    },
  });

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";
  const isMureed = (profile as any)?.is_mureed ?? false;

  const visibleEvents = useMemo(() => events?.filter((e) => {
    if ((e as any).mureeds_only === true && !isMureed && !isAdminOrMod) return false;
    return true;
  }), [events, isMureed, isAdminOrMod]);

  const eventIds = useMemo(() => visibleEvents?.map((e) => e.id) ?? [], [visibleEvents]);

  // Batch-fetch all RSVPs for visible events
  useQuery({
    queryKey: ["batch-rsvps", eventIds],
    staleTime: 2 * 60 * 1000,
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .in("event_id", eventIds);
      if (error) throw error;

      const byEvent: Record<string, typeof data> = {};
      for (const rsvp of data) {
        if (!byEvent[rsvp.event_id]) byEvent[rsvp.event_id] = [];
        byEvent[rsvp.event_id].push(rsvp);
      }
      for (const eid of eventIds) {
        const eventRsvps = byEvent[eid] ?? [];
        queryClient.setQueryData(["rsvps", eid], eventRsvps);
        if (user) {
          const mine = eventRsvps.find((r) => r.user_id === user.id && r.status !== "cancelled") ?? null;
          queryClient.setQueryData(["my-rsvp", eid, user.id], mine);
        }
      }
      return data;
    },
  });

  // Batch-fetch speakers for visible events
  useQuery({
    queryKey: ["batch-speakers", eventIds],
    staleTime: 5 * 60 * 1000,
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("speaker_id, display_order, speakers(id, name, image_url), event_id")
        .in("event_id", eventIds)
        .order("display_order");
      if (error) throw error;

      const byEvent: Record<string, typeof data> = {};
      for (const row of data) {
        if (!byEvent[row.event_id]) byEvent[row.event_id] = [];
        byEvent[row.event_id].push(row);
      }
      for (const eid of eventIds) {
        queryClient.setQueryData(["event-speakers", eid], byEvent[eid] ?? []);
      }
      return data;
    },
  });

  // Batch-fetch potluck dishes
  const potluckEventIds = useMemo(
    () => visibleEvents?.filter((e) => e.has_potluck && e.status !== "cancelled").map((e) => e.id) ?? [],
    [visibleEvents]
  );
  useQuery({
    queryKey: ["batch-potluck", potluckEventIds],
    staleTime: 2 * 60 * 1000,
    enabled: potluckEventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, specific_food_item")
        .in("event_id", potluckEventIds)
        .not("specific_food_item", "is", null)
        .neq("specific_food_item", "");
      if (error) throw error;

      const byEvent: Record<string, string[]> = {};
      for (const row of data) {
        const item = row.specific_food_item?.trim();
        if (item) {
          if (!byEvent[row.event_id]) byEvent[row.event_id] = [];
          byEvent[row.event_id].push(item);
        }
      }
      for (const eid of potluckEventIds) {
        queryClient.setQueryData(["potluck-menu", eid], byEvent[eid] ?? []);
      }
      return data;
    },
  });

  // Batch-fetch the current user's guest requests for visible events
  useBatchMyGuestRequests(eventIds);

  if (ticketEvent) {
    return <TicketView event={ticketEvent} onBack={() => setTicketEvent(null)} />;
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <InstallAppBanner />

      <main className="mx-auto max-w-lg px-4 py-6">
        {isAdminOrMod ? (
          <>
            <AdminQuickActions />
            <AdminDashboardSummary />
          </>
        ) : (
          <MemberDashboardSummary />
        )}

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {tab === "upcoming" ? "Upcoming Activities" : "Past Activities"}
          </h2>
        </div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "upcoming" | "past")} className="mb-4">
          <TabsList className="w-full">
            <TabsTrigger value="upcoming" className="flex-1">Upcoming</TabsTrigger>
            <TabsTrigger value="past" className="flex-1">Past Events</TabsTrigger>
          </TabsList>
        </Tabs>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <EventCardSkeleton key={i} />
            ))}
          </div>
        ) : visibleEvents && visibleEvents.length > 0 ? (
          <div className="space-y-3">
            {visibleEvents.map((event) => (
              <EventCard
                key={event.id}
                event={event}
                onShowTicket={handleShowTicket}
                isPast={tab === "past"}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">
              {tab === "upcoming"
                ? "No upcoming activities scheduled."
                : "No past events found."}
            </p>
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
  const { data: coverage, isLoading: covLoading } = useMyEventCoverage(event.id);

  const effectiveRsvp = myRSVP ?? (coverage as any);

  useEffect(() => {
    if (myRSVP && profile?.name) {
      cacheTicket(myRSVP, event, profile.name);
    }
  }, [myRSVP, event, profile?.name]);

  useEffect(() => {
    if (!isLoading && !covLoading && !effectiveRsvp && !isError) {
      onBack();
    }
  }, [isLoading, covLoading, effectiveRsvp, isError, onBack]);

  if (isLoading || covLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (effectiveRsvp) {
    return <QRTicketScreen event={event} rsvp={effectiveRsvp} profileName={coverage && !myRSVP ? `${coverage.covering_user_name} (family)` : undefined} onBack={onBack} />;
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
