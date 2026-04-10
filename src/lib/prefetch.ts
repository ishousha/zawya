import { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Prefetch data for the Home tab.
 */
export function prefetchHome(queryClient: QueryClient) {
  const now = new Date().toISOString();
  const fallbackCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

  queryClient.prefetchQuery({
    queryKey: ["events"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["active", "full", "cancelled"])
        .or(`end_date_time.gte.${now},and(end_date_time.is.null,date_time.gte.${fallbackCutoff})`)
        .order("date_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      return data;
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
        .select("*")
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
