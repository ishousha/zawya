import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { Link } from "react-router-dom";

interface SpeakerBadgeProps {
  eventId: string;
  prefetchedSpeakers?: any[];
}

export default function SpeakerBadge({ eventId, prefetchedSpeakers }: SpeakerBadgeProps) {
  const { data: fetchedSpeakers } = useQuery({
    queryKey: ["event-speakers", eventId],
    staleTime: 5 * 60 * 1000,
    enabled: !prefetchedSpeakers,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("speaker_id, display_order, speakers(id, name, image_url)")
        .eq("event_id", eventId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  const speakers = prefetchedSpeakers ?? fetchedSpeakers;

  if (!speakers || speakers.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-muted-foreground">Featuring:</span>
      {speakers.map((es: any) => {
        const speaker = es.speakers;
        if (!speaker) return null;
        return (
          <Link
            key={speaker.id}
            to={`/speakers/${speaker.id}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 pl-0.5 pr-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            <Avatar className="h-5 w-5">
              {speaker.image_url ? (
                <AvatarImage src={speaker.image_url} alt={speaker.name} />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-[8px]">
                <User className="h-3 w-3" />
              </AvatarFallback>
            </Avatar>
            {speaker.name}
          </Link>
        );
      })}
    </div>
  );
}
