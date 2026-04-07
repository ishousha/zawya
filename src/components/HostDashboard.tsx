import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UtensilsCrossed, Baby } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface HostDashboardProps {
  eventId: string;
}

export default function HostDashboard({ eventId }: HostDashboardProps) {
  const { data: rsvps } = useQuery({
    queryKey: ["host-rsvps", eventId],
    queryFn: async () => {
      const { data: rsvpData, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      if (!rsvpData || rsvpData.length === 0) return [];

      const userIds = [...new Set(rsvpData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, name, family_name")
        .in("id", userIds);

      const profileMap = new Map((profilesData ?? []).map((p) => [p.id, p]));
      return rsvpData.map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null }));
    },
  });

  if (!rsvps) return null;

  const totalAdults = rsvps.reduce((sum, r) => {
    const deps = (r.attending_dependents as any[]) || [];
    const childDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type !== "elder").length;
    const elderDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type === "elder").length;
    return sum + (r.guests_count - childDeps - elderDeps) + elderDeps;
  }, 0);

  const totalChildren = rsvps.reduce((sum, r) => {
    const deps = (r.attending_dependents as any[]) || [];
    return sum + deps.filter((d) => d.type === "dependent" && d.dependent_type !== "elder").length;
  }, 0);

  const totalHeadcount = totalAdults + totalChildren;

  const potluckItems = rsvps
    .filter((r) => r.specific_food_item?.trim())
    .map((r) => ({
      dish: r.specific_food_item!,
      family: (r.profiles as any)?.family_name || (r.profiles as any)?.name || "Unknown",
    }));

  const guestList = rsvps.map((r) => {
    const profile = r.profiles as any;
    const deps = (r.attending_dependents as any[]) || [];
    const childDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type !== "elder");
    const elderDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type === "elder");
    return {
      name: profile?.name || "Unknown",
      family: profile?.family_name,
      adultsCount: (r.guests_count - childDeps.length - elderDeps.length) + elderDeps.length,
      children: childDeps.map((d: any) => d.name),
      elders: elderDeps.map((d: any) => d.name),
    };
  });

  return (
    <Card className="border-primary/30 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg font-heading">
          <Users className="h-5 w-5 text-primary" />
          Host Dashboard
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Headcount summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalHeadcount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalAdults}</p>
            <p className="text-xs text-muted-foreground">Adults</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalChildren}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Baby className="h-3 w-3" /> Kids
            </p>
          </div>
        </div>

        <Separator />

        {/* Guest list */}
        <div>
          <h4 className="text-sm font-semibold text-foreground mb-2">Guest List</h4>
          {guestList.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No RSVPs yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {guestList.map((g, i) => (
                <li key={i} className="text-sm text-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <div>
                    <span className="font-medium">{g.name}</span>
                    {g.family && <span className="text-muted-foreground"> — {g.family}</span>}
                    <span className="text-muted-foreground text-xs ml-1">
                      ({g.adultsCount} adult{g.adultsCount !== 1 ? "s" : ""}
                      {g.children.length > 0 && `, ${g.children.length} kid${g.children.length !== 1 ? "s" : ""}`}
                      {g.elders.length > 0 && `, ${g.elders.length} elder${g.elders.length !== 1 ? "s" : ""}`})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Potluck items with names */}
        {potluckItems.length > 0 && (
          <>
            <Separator />
            <div>
              <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                <UtensilsCrossed className="h-4 w-4 text-primary" />
                Potluck Menu (Host View)
              </h4>
              <ul className="space-y-1.5">
                {potluckItems.map((item, i) => (
                  <li key={i} className="text-sm text-foreground flex items-start gap-2">
                    <span className="text-primary mt-0.5">•</span>
                    <span>
                      {item.dish} — <span className="text-muted-foreground">{item.family}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
