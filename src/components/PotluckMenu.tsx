import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

interface PotluckMenuProps {
  eventId: string;
  prefetchedDishes?: string[];
}

interface GroupedCategory {
  category: string;
  items: string[];
}

export default function PotluckMenu({ eventId, prefetchedDishes }: PotluckMenuProps) {
  // Legacy: specific_food_item + potluck_category from rsvps
  const { data: legacyRsvps } = useQuery({
    queryKey: ["potluck-menu", eventId],
    enabled: !prefetchedDishes,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("specific_food_item, potluck_category")
        .eq("event_id", eventId)
        .neq("status", "cancelled");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Sign-up item selections
  const { data: signUpSelections } = useQuery({
    queryKey: ["potluck-signup-items", eventId],
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
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

      const itemIds = [...new Set(selections.map((s) => s.sign_up_item_id))];
      const { data: items, error: iErr } = await supabase
        .from("event_sign_up_items")
        .select("id, item_name")
        .in("id", itemIds);
      if (iErr) throw iErr;

      const nameMap = new Map(items?.map((i) => [i.id, i.item_name]) ?? []);
      return selections.map((s) => ({
        category: nameMap.get(s.sign_up_item_id) ?? "Other",
        dish: s.description?.trim() || null,
        quantity: s.quantity ?? 1,
      }));
    },
  });

  const grouped = useMemo<GroupedCategory[]>(() => {
    const categoryMap = new Map<string, string[]>();

    // Process legacy rsvps (potluck_category + specific_food_item)
    if (!prefetchedDishes && legacyRsvps) {
      for (const r of legacyRsvps) {
        const cat = r.potluck_category
          ? r.potluck_category.charAt(0).toUpperCase() + r.potluck_category.slice(1)
          : null;
        const dish = r.specific_food_item?.trim();
        if (!cat && !dish) continue;
        const key = cat ?? "Other";
        if (!categoryMap.has(key)) categoryMap.set(key, []);
        if (dish) categoryMap.get(key)!.push(dish);
      }
    }

    // Process prefetched dishes (flat strings, no category)
    if (prefetchedDishes) {
      for (const d of prefetchedDishes) {
        const trimmed = d.trim();
        if (!trimmed) continue;
        const key = "Items";
        if (!categoryMap.has(key)) categoryMap.set(key, []);
        categoryMap.get(key)!.push(trimmed);
      }
    }

    // Process sign-up item selections (item_name as category, description as dish)
    if (signUpSelections) {
      for (const s of signUpSelections) {
        const key = s.category;
        if (!categoryMap.has(key)) categoryMap.set(key, []);
        if (s.dish) {
          categoryMap.get(key)!.push(s.dish);
        }
      }
    }

    return Array.from(categoryMap.entries())
      .map(([category, items]) => ({ category, items }))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [legacyRsvps, signUpSelections, prefetchedDishes]);

  const totalItems = grouped.reduce((sum, g) => sum + Math.max(g.items.length, 1), 0);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Current Menu</h4>
      </div>
      {totalItems === 0 || grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No items claimed yet. Be the first!
        </p>
      ) : (
        <ul className="space-y-1.5">
          {grouped.map((g) => {
            const count = g.items.length;
            const dishList = count > 0
              ? g.items.join(", ")
              : "Undecided";
            return (
              <li key={g.category} className="text-sm text-foreground">
                <span className="text-primary mr-1.5">•</span>
                <span className="font-semibold">{g.category}</span>
                {count > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({count} {count === 1 ? "item" : "items"})
                  </span>
                )}
                <span className="text-muted-foreground">: </span>
                <span>{dishList}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
