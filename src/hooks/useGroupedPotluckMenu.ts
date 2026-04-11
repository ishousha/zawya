import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

export interface GroupedCategory {
  category: string;
  items: string[];
}

export function useGroupedPotluckMenu(eventId: string, prefetchedDishes?: string[]) {
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

    if (prefetchedDishes) {
      for (const d of prefetchedDishes) {
        const trimmed = d.trim();
        if (!trimmed) continue;
        const key = "Items";
        if (!categoryMap.has(key)) categoryMap.set(key, []);
        categoryMap.get(key)!.push(trimmed);
      }
    }

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

  return grouped;
}
