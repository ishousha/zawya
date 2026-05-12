import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User, ArrowLeft, Calendar } from "lucide-react";
import { format } from "date-fns";

export default function SpeakerProfile() {
  const { speakerId } = useParams<{ speakerId: string }>();
  const navigate = useNavigate();

  const { data: speaker, isLoading } = useQuery({
    queryKey: ["speaker", speakerId],
    enabled: !!speakerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("id", speakerId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: speakerEvents } = useQuery({
    queryKey: ["speaker-events", speakerId],
    enabled: !!speakerId,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("events(id, title, date_time, status)")
        .eq("speaker_id", speakerId!)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!speaker) {
    return (
      <div className="min-h-screen bg-background pb-24">
        <div className="px-4 py-8 text-center">
          <p className="text-muted-foreground">Special guest not found.</p>
          <Button variant="link" onClick={() => navigate("/")}>Go Home</Button>
        </div>
      </div>
    );
  }

  const now = new Date();
  const events = (speakerEvents ?? [])
    .map((se: any) => se.events)
    .filter(Boolean)
    .sort((a: any, b: any) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
  const upcoming = events.filter((e: any) => new Date(e.date_time) >= now && e.status !== "cancelled");
  const past = events.filter((e: any) => new Date(e.date_time) < now || e.status === "cancelled");

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="mx-auto max-w-lg px-4 py-4">
        <Button variant="ghost" size="sm" className="mb-4 -ml-2 gap-1.5" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>

        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center gap-4">
              <Avatar className="h-24 w-24 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
                {speaker.image_url ? (
                  <AvatarImage src={speaker.image_url} alt={speaker.name} />
                ) : null}
                <AvatarFallback className="bg-primary/10">
                  <User className="h-10 w-10 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="font-heading text-2xl font-bold text-card-foreground">
                  {speaker.name}
                </h1>
                {speaker.bio && (
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {speaker.bio}
                  </p>
                )}
              </div>

              {events.length > 0 && (
                <div className="w-full mt-4 space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Featured In
                  </p>
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {upcoming.map((event: any) => (
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
                    {past.map((event: any) => (
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
      </div>
    </div>
  );
}
