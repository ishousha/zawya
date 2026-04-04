import { useMemo } from "react";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];

/**
 * Checks if a specific food item is already claimed by another RSVP in the same category.
 * Returns a boolean and the list of already-claimed items for a category.
 */
export function useDuplicateFoodCheck(
  rsvps: RSVP[] | undefined,
  currentUserId: string | undefined
) {
  const claimedItemsByCategory = useMemo(() => {
    const map: Record<string, { item: string; userId: string }[]> = {};
    if (!rsvps) return map;

    for (const rsvp of rsvps) {
      if (rsvp.potluck_category && rsvp.specific_food_item) {
        if (!map[rsvp.potluck_category]) {
          map[rsvp.potluck_category] = [];
        }
        map[rsvp.potluck_category].push({
          item: rsvp.specific_food_item,
          userId: rsvp.user_id,
        });
      }
    }
    return map;
  }, [rsvps]);

  const isDuplicate = (category: string, foodItem: string): boolean => {
    const items = claimedItemsByCategory[category] || [];
    return items.some(
      (i) =>
        i.userId !== currentUserId &&
        i.item.toLowerCase().trim() === foodItem.toLowerCase().trim()
    );
  };

  return { claimedItemsByCategory, isDuplicate };
}
