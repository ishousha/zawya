import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Detects whether the current user's RSVP for a potluck event is "missing"
 * its potluck selections — typically because an admin edit cascaded-deleted
 * the linked sign-up items in the past, wiping their claims.
 *
 * Returns true when ALL of the following hold:
 *  - event has potluck enabled and at least one sign-up item
 *  - user has an active (non-cancelled) RSVP for the event
 *  - user has zero rsvp_sign_up_selections rows
 *  - user's free-text `specific_food_item` is empty
 *  - the event hasn't ended yet
 */
export function useNeedsReclaim(eventId: string, hasPotluck: boolean | null | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["needs-reclaim", eventId, user?.id],
    enabled: !!user && !!eventId && hasPotluck === true,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // 1) Confirm the event still has sign-up items
      const { data: items, error: itemsErr } = await supabase
        .from("event_sign_up_items")
        .select("id")
        .eq("event_id", eventId)
        .limit(1);
      if (itemsErr) throw itemsErr;
      if (!items || items.length === 0) return false;

      // 2) Find user's active RSVP
      const { data: rsvp, error: rsvpErr } = await supabase
        .from("rsvps")
        .select("id, specific_food_item, status")
        .eq("event_id", eventId)
        .eq("user_id", user!.id)
        .neq("status", "cancelled")
        .maybeSingle();
      if (rsvpErr) throw rsvpErr;
      if (!rsvp) return false;

      const hasFreeText = !!(rsvp.specific_food_item ?? "").trim();
      if (hasFreeText) return false;

      // 3) Count their selections
      const { count, error: selErr } = await supabase
        .from("rsvp_sign_up_selections")
        .select("*", { count: "exact", head: true })
        .eq("rsvp_id", rsvp.id);
      if (selErr) throw selErr;

      return (count ?? 0) === 0;
    },
  });
}
