import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import EventCard from "@/components/EventCard";
import { Loader2 } from "lucide-react";

export default function HomeFeed() {
  const { profile } = useAuth();

  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "active")
        .gte("date_time", new Date().toISOString())
        .order("date_time", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Zawya</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Welcome back{profile?.name ? `, ${profile.name}` : ""}
        </p>
      </header>

      {/* Events */}
      <main className="mx-auto max-w-lg px-4 py-6">
        <h2 className="mb-4 font-heading text-lg font-semibold text-foreground">
          Upcoming Gatherings
        </h2>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card p-8 text-center">
            <p className="text-muted-foreground">No upcoming gatherings scheduled.</p>
          </div>
        )}
      </main>
    </div>
  );
}
