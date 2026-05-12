import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import type { Database } from "@/integrations/supabase/types";

export type EventType = Database["public"]["Tables"]["event_types"]["Row"];

export function useEventTypes() {
  return useQuery({
    queryKey: ["event-types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_types")
        .select("*")
        .order("display_order")
        .order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 min
  });
}

/** Icon name → lucide component map helper */
import {
  MapPin, Video, Users, BookOpen, Mountain, Handshake,
  Calendar, Clock, Heart, Star, Music, Utensils, Coffee,
  Mic, GraduationCap, Tent, Flame, Globe, Church, Baby,
  Palette, Dumbbell, TreePine, Sparkles, PartyPopper,
} from "lucide-react";

const ICON_MAP: Record<string, any> = {
  MapPin, Video, Users, BookOpen, Mountain, Handshake,
  Calendar, Clock, Heart, Star, Music, Utensils, Coffee,
  Mic, GraduationCap, Tent, Flame, Globe, Church, Baby,
  Palette, Dumbbell, TreePine, Sparkles, PartyPopper,
};

export const EVENT_TYPE_ICON_NAMES = Object.keys(ICON_MAP);

export function getEventTypeIcon(iconName: string) {
  return ICON_MAP[iconName] ?? MapPin;
}
