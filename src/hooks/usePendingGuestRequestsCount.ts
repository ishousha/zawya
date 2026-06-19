import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Count of guest_requests in 'pending' status. Used by Admin Dashboard tab
 * badge and Home quick-action card.
 */
export function usePendingGuestRequestsCount() {
  const { profile } = useAuth();
  const isAdminOrMod = profile?.role === "admin" || (profile?.role as string) === "moderator";

  return useQuery({
    queryKey: ["pending-guest-requests-count"],
    enabled: isAdminOrMod,
    staleTime: 30_000,
    refetchInterval: isAdminOrMod ? 60_000 : false,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("guest_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}
