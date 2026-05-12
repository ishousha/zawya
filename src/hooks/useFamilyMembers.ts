import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";

export interface FamilyMember {
  id: string;
  name: string | null;
  isSelf: boolean;
}

/**
 * Returns all profiles sharing the current user's family_id.
 * If the user has no family_id, returns only the current user.
 */
export function useFamilyMembers() {
  const { user, profile } = useAuth();

  return useQuery<FamilyMember[]>({
    queryKey: ["family-members", user?.id, profile?.family_id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      if (!user || !profile) return [];

      const familyId = (profile as any).family_id as string | null;

      // No family assigned — just show self
      if (!familyId) {
        return [{ id: user.id, name: profile.name, isSelf: true }];
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, name")
        .eq("family_id", familyId);

      if (error) throw error;

      return (data || []).map((p) => ({
        id: p.id,
        name: p.name,
        isSelf: p.id === user.id,
      }));
    },
  });
}
