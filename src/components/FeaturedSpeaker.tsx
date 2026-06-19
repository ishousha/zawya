import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";
import { Link } from "react-router-dom";

interface FeaturedSpeakersProps {
  eventId: string;
}

export default function FeaturedSpeakers({ eventId }: FeaturedSpeakersProps) {
  const { data: speakers } = useQuery({
    queryKey: ["event-speakers", eventId],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("speaker_id, display_order, speakers(*)")
        .eq("event_id", eventId)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });

  if (!speakers || speakers.length === 0) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
        {speakers.length === 1 ? "Featured Special Guest" : "Featured Special Guests"}
      </p>
      <div className={speakers.length === 1 ? "" : "space-y-5"}>
        {speakers.map((es: any) => {
          const speaker = es.speakers;
          if (!speaker) return null;
          return (
            <Link
              key={speaker.id}
              to={`/speakers/${speaker.id}`}
              className="flex flex-col items-center text-center gap-3 group"
            >
              <Avatar className="h-20 w-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background group-hover:ring-primary/40 transition-all">
                {speaker.image_url ? (
                  <AvatarImage src={speaker.image_url} alt={speaker.name} className="object-cover" />
                ) : null}
                <AvatarFallback className="bg-primary/10">
                  <User className="h-8 w-8 text-primary" />
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-heading text-lg font-bold text-card-foreground group-hover:text-primary transition-colors">
                  {speaker.name}
                </h3>
                {speaker.bio && (
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
                    {speaker.bio}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
