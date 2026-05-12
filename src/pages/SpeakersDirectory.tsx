import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, User, ArrowLeft, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

interface SpeakerEvent {
  event_id: string;
  events: {
    id: string;
    title: string;
    date_time: string;
    status: string;
  } | null;
}

export default function SpeakersDirectory() {
  const navigate = useNavigate();

  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch all event_speakers with event info in one query
  const { data: speakerEvents } = useQuery({
    queryKey: ["speaker-events-directory"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("speaker_id, events(id, title, date_time, status)")
        .order("display_order");
      if (error) throw error;
      return data as (SpeakerEvent & { speaker_id: string })[];
    },
  });

  // Group events by speaker_id
  const eventsBySpeaker = speakerEvents?.reduce<Record<string, { id: string; title: string; date_time: string; status: string }[]>>(
    (acc, se) => {
      if (se.events) {
        if (!acc[se.speaker_id]) acc[se.speaker_id] = [];
        acc[se.speaker_id].push(se.events);
      }
      return acc;
    },
    {}
  ) ?? {};

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="mx-auto max-w-lg">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Special Guests
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Special guests and scholars in our community
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 py-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : speakers && speakers.length > 0 ? (
          <div className="space-y-4">
            {speakers.map((speaker) => {
              const events = eventsBySpeaker[speaker.id] ?? [];
              // Sort: upcoming first, then past
              const sortedEvents = [...events].sort(
                (a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime()
              );
              const now = new Date();
              const upcoming = sortedEvents.filter(e => new Date(e.date_time) >= now && e.status !== "cancelled");
              const past = sortedEvents.filter(e => new Date(e.date_time) < now || e.status === "cancelled");

              return (
                <Card key={speaker.id}>
                  <CardContent className="p-5">
                    <div className="flex flex-col items-center text-center gap-3">
                      <Avatar className="h-20 w-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                        {speaker.image_url ? (
                          <AvatarImage src={speaker.image_url} alt={speaker.name} />
                        ) : null}
                        <AvatarFallback className="bg-primary/10">
                          <User className="h-8 w-8 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h2 className="font-heading text-lg font-bold text-card-foreground">
                          {speaker.name}
                        </h2>
                        {speaker.bio && (
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            {speaker.bio}
                          </p>
                        )}
                      </div>

                      {/* Events this speaker is featured in */}
                      {sortedEvents.length > 0 && (
                        <div className="w-full mt-2 space-y-1.5">
                          <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                            Featured In
                          </p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {upcoming.map(event => (
                              <Badge
                                key={event.id}
                                variant="default"
                                className="cursor-pointer gap-1 text-xs"
                                onClick={() => navigate(`/events/${event.id}`)}
                              >
                                <Calendar className="h-3 w-3" />
                                {event.title}
                                <span className="opacity-70">· {format(new Date(event.date_time), "MMM d")}</span>
                              </Badge>
                            ))}
                            {past.slice(0, 3).map(event => (
                              <Badge
                                key={event.id}
                                variant="secondary"
                                className="cursor-pointer gap-1 text-xs opacity-70"
                                onClick={() => navigate(`/events/${event.id}`)}
                              >
                                {event.title}
                                <span>· {format(new Date(event.date_time), "MMM d")}</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            No special guests added yet.
          </p>
        )}
      </main>
    </div>
  );
}
