import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Loader2, AlertTriangle, UtensilsCrossed } from "lucide-react";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface AffectedRsvp {
  rsvp_id: string;
  user_id: string;
  user_name: string | null;
  user_email: string | null;
}

interface AffectedEvent {
  event_id: string;
  title: string;
  date_time: string;
  affected: AffectedRsvp[];
}

/**
 * Lists upcoming potluck events where attending members have NO selections
 * and no free-text potluck dish — i.e. their claims need to be re-entered.
 */
export default function PotluckReclaimReport() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-potluck-reclaim-report"],
    staleTime: 60 * 1000,
    queryFn: async (): Promise<AffectedEvent[]> => {
      const nowIso = new Date().toISOString();

      // Upcoming, non-cancelled potluck events
      const { data: events, error: evErr } = await supabase
        .from("events")
        .select("id, title, date_time, has_potluck, status, end_date_time")
        .eq("has_potluck", true)
        .neq("status", "cancelled")
        .or(`end_date_time.gte.${nowIso},end_date_time.is.null`)
        .gte("date_time", nowIso)
        .order("date_time", { ascending: true });
      if (evErr) throw evErr;
      if (!events || events.length === 0) return [];

      const eventIds = events.map((e: any) => e.id);

      // Only events that actually have sign-up items configured
      const { data: items, error: itemsErr } = await supabase
        .from("event_sign_up_items")
        .select("event_id")
        .in("event_id", eventIds);
      if (itemsErr) throw itemsErr;
      const eventsWithItems = new Set((items ?? []).map((i: any) => i.event_id));

      // All active RSVPs for those events
      const { data: rsvps, error: rsvpErr } = await supabase
        .from("rsvps")
        .select("id, user_id, event_id, specific_food_item, status")
        .in("event_id", Array.from(eventsWithItems))
        .neq("status", "cancelled");
      if (rsvpErr) throw rsvpErr;
      if (!rsvps || rsvps.length === 0) return [];

      // Selections grouped by rsvp_id
      const rsvpIds = rsvps.map((r) => r.id);
      const { data: sels, error: selErr } = await supabase
        .from("rsvp_sign_up_selections")
        .select("rsvp_id")
        .in("rsvp_id", rsvpIds);
      if (selErr) throw selErr;
      const rsvpsWithSelections = new Set((sels ?? []).map((s: any) => s.rsvp_id));

      // Affected = no selection rows AND no free-text dish
      const affected = rsvps.filter((r: any) => {
        if (rsvpsWithSelections.has(r.id)) return false;
        const txt = (r.specific_food_item ?? "").toString().trim();
        return txt.length === 0;
      });

      if (affected.length === 0) return [];

      // Profile lookup
      const userIds = Array.from(new Set(affected.map((r) => r.user_id)));
      const { data: profiles, error: pErr } = await supabase
        .from("profiles")
        .select("id, name, email")
        .in("id", userIds);
      if (pErr) throw pErr;
      const profileMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));

      // Group by event
      const byEvent = new Map<string, AffectedRsvp[]>();
      for (const r of affected) {
        const p = profileMap.get(r.user_id);
        const list = byEvent.get(r.event_id) ?? [];
        list.push({
          rsvp_id: r.id,
          user_id: r.user_id,
          user_name: p?.name ?? null,
          user_email: p?.email ?? null,
        });
        byEvent.set(r.event_id, list);
      }

      return events
        .filter((e: any) => byEvent.has(e.id))
        .map((e: any) => ({
          event_id: e.id,
          title: e.title,
          date_time: e.date_time,
          affected: (byEvent.get(e.id) ?? []).sort((a, b) =>
            (a.user_name ?? "").localeCompare(b.user_name ?? "")
          ),
        }));
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="text-sm text-destructive">Failed to load reclaim report.</p>
    );
  }

  const totalAffected = (data ?? []).reduce((sum, e) => sum + e.affected.length, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base font-heading">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          Potluck Reclaim Report
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Members with active RSVPs on potluck events but no current potluck selection. They should be nudged to re-claim.
        </p>
      </CardHeader>
      <CardContent>
        {!data || data.length === 0 ? (
          <div className="rounded-md border border-border bg-muted/30 p-4 text-center">
            <p className="text-sm text-muted-foreground">
              🎉 All potluck members have current selections. Nothing to reclaim.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <p className="text-sm">
                <strong>{totalAffected}</strong> member{totalAffected === 1 ? "" : "s"} across{" "}
                <strong>{data.length}</strong> event{data.length === 1 ? "" : "s"} need to reclaim.
              </p>
            </div>

            {data.map((ev) => (
              <div key={ev.event_id} className="rounded-lg border border-border bg-card">
                <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(ev.date_time), "EEE, MMM d • h:mm a")}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                    {ev.affected.length}
                  </span>
                </div>
                <ul className="divide-y divide-border">
                  {ev.affected.map((m) => (
                    <li key={m.rsvp_id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="truncate font-medium text-foreground">
                        {m.user_name || "Unnamed member"}
                      </span>
                      {m.user_email && (
                        <a
                          href={`mailto:${m.user_email}?subject=${encodeURIComponent(
                            `Please re-select your potluck items for ${ev.title}`
                          )}`}
                          className="shrink-0 truncate text-xs text-primary hover:underline"
                        >
                          {m.user_email}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
