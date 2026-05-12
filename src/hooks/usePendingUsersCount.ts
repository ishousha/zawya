import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";

export function usePendingUsersCount() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  return useQuery({
    queryKey: ["pending-users-count"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: isAdmin ? 60_000 : false,
  });
}
