import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useMyGuestRequests(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-guest-requests", eventId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*")
        .eq("event_id", eventId)
        .eq("requesting_user_id", user!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateGuestRequest(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: { guest_name: string; guest_email: string; guest_phone?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("guest_requests")
        .insert({
          event_id: eventId,
          requesting_user_id: user.id,
          guest_name: input.guest_name,
          guest_email: input.guest_email,
          guest_phone: input.guest_phone || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-guest-requests", eventId, user?.id] });
    },
  });
}

/** Admin: fetch all pending guest requests for an event */
export function useEventGuestRequests(eventId: string | null) {
  return useQuery({
    queryKey: ["admin-guest-requests", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*, profiles:requesting_user_id(name, email)")
        .eq("event_id", eventId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateGuestRequestStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
    },
  });
}
