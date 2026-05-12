import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useMemo } from "react";

export interface GroupedCategory {
  category: string;
  items: string[];
}

export function useGroupedPotluckMenu(eventId: string, prefetchedDishes?: string[]) {
  const { data: rows } = useQuery({
    queryKey: ["potluck-menu-rpc", eventId],
    enabled: !prefetchedDishes && !!eventId,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("get_event_potluck_menu", {
        _event_id: eventId,
      });
      if (error) throw error;
      return (data ?? []) as Array<{
        category: string;
        dish: string;
        quantity: number;
        order_index: number;
      }>;
    },
  });

  const grouped = useMemo<GroupedCategory[]>(() => {
    const categoryMap = new Map<string, { items: string[]; order: number }>();

    if (prefetchedDishes) {
      const key = "Items";
      categoryMap.set(key, { items: [], order: 0 });
      for (const d of prefetchedDishes) {
        const trimmed = d.trim();
        if (!trimmed) continue;
        categoryMap.get(key)!.items.push(trimmed);
      }
    } else if (rows) {
      for (const r of rows) {
        const cat = r.category || "Other";
        if (!categoryMap.has(cat)) categoryMap.set(cat, { items: [], order: r.order_index ?? 9000 });
        const dish = (r.dish || "").trim();
        if (dish && dish.toLowerCase() !== "undecided") {
          categoryMap.get(cat)!.items.push(dish);
        }
      }
    }

    return Array.from(categoryMap.entries())
      .map(([category, v]) => ({ category, items: v.items, _order: v.order }))
      .sort((a, b) => a._order - b._order || a.category.localeCompare(b.category))
      .map(({ category, items }) => ({ category, items }));
  }, [rows, prefetchedDishes]);

  return grouped;
}
