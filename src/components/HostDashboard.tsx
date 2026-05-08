import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UtensilsCrossed, Baby, UserRound, CheckCircle2 } from "lucide-react";
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

      const userIds = [...new Set(rsvpData.map((r) => r.user_id))];
      const { data: profilesData } = await supabase
        .rpc("get_event_attendee_profiles", { _event_id: eventId });

      const profileMap = new Map(((profilesData ?? []) as Array<{ id: string; name: string | null; family_name: string | null }>).map((p) => [p.id, p]));
      return rsvpData.map((r) => ({ ...r, profiles: profileMap.get(r.user_id) ?? null }));
    },
  });

  const { data: signUpData } = useQuery({
    queryKey: ["host-signup-items", eventId, (rsvps ?? []).map((r) => r.id).sort().join(",")],
    enabled: !!rsvps && rsvps.length > 0,
    queryFn: async () => {
      const { data: items, error: iErr } = await supabase
        .from("event_sign_up_items")
        .select("id, item_name, order_index")
        .eq("event_id", eventId)
        .order("order_index");
      if (iErr) throw iErr;
      const rsvpIds = (rsvps ?? []).map((r) => r.id);
      if (rsvpIds.length === 0 || !items || items.length === 0) return { items: items ?? [], selections: [] };
      const { data: sels, error: sErr } = await supabase
        .from("rsvp_sign_up_selections")
        .select("rsvp_id, sign_up_item_id, quantity, description")
        .in("rsvp_id", rsvpIds);
      if (sErr) throw sErr;
      return { items, selections: sels ?? [] };
    },
  });

  // Note: Realtime subscription removed for security — RSVP data refreshes via
  // refetchInterval and on window focus instead. This avoids broadcasting other
  // attendees' RSVP changes to all subscribers.

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

  const rsvpById = new Map(rsvps.map((r) => [r.id, r]));
  const itemById = new Map((signUpData?.items ?? []).map((i: any) => [i.id, i]));

  const structuredPotluck = (signUpData?.selections ?? []).flatMap((s: any) => {
    const r: any = rsvpById.get(s.rsvp_id);
    if (!r || r.status === "cancelled") return [];
    const item: any = itemById.get(s.sign_up_item_id);
    const itemName = item?.item_name || "Item";
    const desc = (s.description ?? "").toString().trim();
    const dish = desc ? `${itemName} — ${desc}` : itemName;
    return [{
      dish,
      family: (r.profiles as any)?.family_name || (r.profiles as any)?.name || "Unknown",
      order: item?.order_index ?? 9000,
    }];
  });

  const legacyPotluck = rsvps
    .filter((r) => r.specific_food_item?.trim())
    .map((r) => ({
      dish: r.specific_food_item!.trim(),
      family: (r.profiles as any)?.family_name || (r.profiles as any)?.name || "Unknown",
      order: 9999,
    }));

  const potluckItems = [...structuredPotluck, ...legacyPotluck].sort((a, b) => a.order - b.order);

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
