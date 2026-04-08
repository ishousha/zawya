import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, User, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function SpeakersDirectory() {
  const navigate = useNavigate();

  const { data: speakers, isLoading } = useQuery({
    queryKey: ["speakers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="mx-auto max-w-lg">
          <Button variant="ghost" size="sm" className="mb-2 -ml-2 gap-1.5" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Speakers & Sheikhs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Guest speakers and scholars in our community
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
            {speakers.map((speaker) => (
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-12">
            No speakers added yet.
          </p>
        )}
      </main>
    </div>
  );
}
