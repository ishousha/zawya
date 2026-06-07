import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";

/**
 * Prefetch data for the Home tab.
 */
export function prefetchHome(queryClient: QueryClient) {
  const fallbackCutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  queryClient.prefetchQuery({
    queryKey: ["events"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, end_date_time, location, address, maps_url, status, cover_photo_url, event_type_id, capacity, has_potluck, virtual_link, zoom_link, online_link, is_hybrid, host_id, description, venue_id, ticket_fee, mureeds_only, age_group, location_hint, etiquette_notes, payment_instructions, waitlist_capacity, published, scheduled_publish_at, last_published_at, created_at, updated_at")
        .in("status", ["active", "full", "cancelled"])
        .or(`end_date_time.gte.${fallbackCutoff},and(end_date_time.is.null,date_time.gte.${fallbackCutoff})`)
        .order("date_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data as unknown as import("@/integrations/supabase/types").Database["public"]["Tables"]["events"]["Row"][];
    },
  });
}

/**
 * Prefetch data for the Library tab.
 */
export function prefetchLibrary(queryClient: QueryClient) {
  queryClient.prefetchQuery({
    queryKey: ["resources"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Prefetch data for the Admin tab.
 */
export function prefetchAdmin(queryClient: QueryClient) {
  queryClient.prefetchQuery({
    queryKey: ["admin-events"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_PUBLIC_COLUMNS)
        .order("date_time", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Prefetch data for the Profile tab.
 */
export function prefetchProfile(queryClient: QueryClient, userId?: string) {
  if (!userId) return;
  queryClient.prefetchQuery({
    queryKey: ["notifications", userId],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });
}
