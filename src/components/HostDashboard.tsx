import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Baby, UserRound, CheckCircle2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface HostDashboardProps {
  eventId: string;
  hideGuestList?: boolean;
}

export default function HostDashboard({ eventId, hideGuestList = false }: HostDashboardProps) {
  const { data: rsvps } = useQuery({
    queryKey: ["host-rsvps", eventId],
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      const { data: rsvpData, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      if (!rsvpData || rsvpData.length === 0) return [];

      const { data: profilesData, error: pErr } = await supabase
        .rpc("get_event_attendee_profiles", { _event_id: eventId });
      if (pErr) console.warn("[HostDashboard] attendee profiles RPC failed", pErr);

      const profileMap = new Map(((profilesData ?? []) as Array<{ id: string; name: string | null; family_name: string | null }>).map((p) => [p.id, p]));
      return rsvpData.map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null }));
    },
  });

  if (!rsvps) return null;

  const totalElders = rsvps.reduce((sum, r) => {
    const deps = (r.attending_dependents as any[]) || [];
    return sum + deps.filter((d) => d.type === "dependent" && d.dependent_type === "elder").length;
  }, 0);

  const totalRegularAdults = rsvps.reduce((sum, r) => {
    const deps = (r.attending_dependents as any[]) || [];
    const childDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type !== "elder").length;
    const elderDeps = deps.filter((d) => d.type === "dependent" && d.dependent_type === "elder").length;
    return sum + (r.guests_count - childDeps - elderDeps);
  }, 0);

  const totalAdults = totalRegularAdults + totalElders;

  const totalChildren = rsvps.reduce((sum, r) => {
    const deps = (r.attending_dependents as any[]) || [];
    return sum + deps.filter((d) => d.type === "dependent" && d.dependent_type !== "elder").length;
  }, 0);

  const totalHeadcount = totalAdults + totalChildren;

  const checkedInCount = rsvps.filter((r) => r.checked_in).length;

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
      checkedIn: r.checked_in,
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
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalHeadcount}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalRegularAdults}</p>
            <p className="text-xs text-muted-foreground">Adults</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalElders}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <UserRound className="h-3 w-3" /> Elders
            </p>
          </div>
          <div className="rounded-lg border border-border bg-card p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{totalChildren}</p>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
              <Baby className="h-3 w-3" /> Kids
            </p>
          </div>
          <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-center">
            <p className="text-2xl font-bold text-emerald-700">{checkedInCount}</p>
            <p className="text-xs text-emerald-600 flex items-center justify-center gap-1">
              <CheckCircle2 className="h-3 w-3" /> Arrived
            </p>
          </div>
        </div>

        {!hideGuestList && (
          <>
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
                      {g.checkedIn ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
                      ) : (
                        <span className="text-muted-foreground/40 mt-0.5 shrink-0">○</span>
                      )}
                      <div>
                        <span className="font-medium">{g.name}</span>
                        {g.checkedIn && <span className="text-xs text-emerald-600 ml-1">arrived</span>}
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
          </>
        )}
      </CardContent>
    </Card>
  );
}
