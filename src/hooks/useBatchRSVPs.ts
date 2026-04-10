import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];

/**
 * Batch-fetch all RSVPs for a list of event IDs in a single query.
 * Returns a map: eventId → RSVP[]
 */
export function useBatchEventRSVPs(eventIds: string[]) {
  return useQuery({
    queryKey: ["batch-rsvps", eventIds],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .in("event_id", eventIds);
      if (error) throw error;

      const map: Record<string, RSVP[]> = {};
      for (const id of eventIds) map[id] = [];
      for (const rsvp of data) {
        if (!map[rsvp.event_id]) map[rsvp.event_id] = [];
        map[rsvp.event_id].push(rsvp);
      }
      return map;
    },
  });
}

/**
 * Batch-fetch all speakers for a list of event IDs in a single query.
 * Returns a map: eventId → speaker[]
 */
export function useBatchEventSpeakers(eventIds: string[]) {
  return useQuery({
    queryKey: ["batch-event-speakers", eventIds],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("event_id, speaker_id, display_order, speakers(id, name, image_url)")
        .in("event_id", eventIds)
        .order("display_order");
      if (error) throw error;

      const map: Record<string, typeof data> = {};
      for (const id of eventIds) map[id] = [];
      for (const row of data) {
        if (!map[row.event_id]) map[row.event_id] = [];
        map[row.event_id].push(row);
      }
      return map;
    },
  });
}

/**
 * Batch-fetch potluck dishes for a list of event IDs in a single query.
 * Returns a map: eventId → string[]
 */
export function useBatchPotluckDishes(eventIds: string[]) {
  return useQuery({
    queryKey: ["batch-potluck", eventIds],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    enabled: eventIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("event_id, specific_food_item")
        .in("event_id", eventIds)
        .not("specific_food_item", "is", null)
        .neq("specific_food_item", "");
      if (error) throw error;

      const map: Record<string, string[]> = {};
      for (const id of eventIds) map[id] = [];
      for (const row of data) {
        const item = row.specific_food_item?.trim();
        if (item) {
          if (!map[row.event_id]) map[row.event_id] = [];
          map[row.event_id].push(item);
        }
      }
      return map;
    },
  });
}
