import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function usePendingUsersCount() {
  return useQuery({
    queryKey: ["pending-users-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "pending");
      if (error) throw error;
      return count ?? 0;
    },
    refetchInterval: 30_000, // refresh every 30s
  });
}
