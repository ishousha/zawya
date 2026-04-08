import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { User } from "lucide-react";

interface FeaturedSpeakerProps {
  speakerId: string;
}

export default function FeaturedSpeaker({ speakerId }: FeaturedSpeakerProps) {
  const { data: speaker } = useQuery({
    queryKey: ["speaker", speakerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .eq("id", speakerId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (!speaker) return null;

  return (
    <div className="rounded-xl border border-border bg-card p-5 mt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-4">
        Featured Speaker
      </p>
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
          <h3 className="font-heading text-lg font-bold text-card-foreground">
            {speaker.name}
          </h3>
          {speaker.bio && (
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-md">
              {speaker.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
