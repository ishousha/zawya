import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

interface PotluckMenuProps {
  eventId: string;
  prefetchedDishes?: string[];
}

/** Shuffles an array using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PotluckMenu({ eventId, prefetchedDishes }: PotluckMenuProps) {
  // Legacy: specific_food_item from rsvps
  const { data: fetchedDishes } = useQuery({
    queryKey: ["potluck-menu", eventId],
    enabled: !prefetchedDishes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("specific_food_item")
        .eq("event_id", eventId)
        .not("specific_food_item", "is", null)
        .neq("specific_food_item", "");
      if (error) throw error;
      return data
        .map((r) => r.specific_food_item!)
        .filter((item) => item.trim().length > 0);
    },
  });

  // Sign-up item selections
  const { data: signUpDishes } = useQuery({
    queryKey: ["potluck-signup-items", eventId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      // Get all non-cancelled rsvp IDs for this event
      const { data: rsvps, error: rErr } = await supabase
        .from("rsvps")
        .select("id")
        .eq("event_id", eventId)
        .neq("status", "cancelled");
      if (rErr) throw rErr;
      if (!rsvps || rsvps.length === 0) return [];

      const rsvpIds = rsvps.map((r) => r.id);
      const { data: selections, error: sErr } = await supabase
        .from("rsvp_sign_up_selections")
        .select("quantity, sign_up_item_id, description")
        .in("rsvp_id", rsvpIds);
      if (sErr) throw sErr;
      if (!selections || selections.length === 0) return [];

      // Get item names
      const itemIds = [...new Set(selections.map((s) => s.sign_up_item_id))];
      const { data: items, error: iErr } = await supabase
        .from("event_sign_up_items")
        .select("id, item_name")
        .in("id", itemIds);
      if (iErr) throw iErr;

      const nameMap = new Map(items?.map((i) => [i.id, i.item_name]) ?? []);
      return selections.map((s) => {
        const name = nameMap.get(s.sign_up_item_id) ?? "Item";
        const desc = s.description?.trim();
        return desc ? `${name}: ${desc}` : name;
      });
    },
  });

  const dishes = prefetchedDishes ?? fetchedDishes;
  const allDishes = useMemo(() => {
    const combined = [...(dishes ?? []), ...(signUpDishes ?? [])];
    return shuffle(combined);
  }, [dishes, signUpDishes]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Current Menu</h4>
      </div>
      {allDishes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No items claimed yet. Be the first!
        </p>
      ) : (
        <ul className="space-y-1">
          {allDishes.map((dish, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              {dish}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
