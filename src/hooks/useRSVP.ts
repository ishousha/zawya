import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateQRHash } from "@/lib/qr-hash";
import { notifyRSVPCreated, notifyRSVPUpdated, notifyRSVPCancelled } from "@/lib/webhooks";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type RSVPInsert = Database["public"]["Tables"]["rsvps"]["Insert"];
type PotluckCategory = Database["public"]["Enums"]["potluck_category"];

export function useEventRSVPs(eventId: string) {
  return useQuery({
    queryKey: ["rsvps", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return data as RSVP[];
    },
  });
}

export function useMyRSVP(eventId: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-rsvp", eventId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data as RSVP | null;
    },
    enabled: !!user,
  });
}

export function usePotluckConfig(eventId: string) {
  return useQuery({
    queryKey: ["potluck-config", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("potluck_config")
        .select("*")
        .eq("event_id", eventId);
      if (error) throw error;
      return data;
    },
  });
}

export function useRSVPConcurrency(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createRSVP = useMutation({
    mutationFn: async (input: {
      guests_count: number;
      potluck_category?: PotluckCategory | null;
      specific_food_item?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const rsvpId = crypto.randomUUID();
      const qrHash = await generateQRHash(rsvpId);

      const rsvpData: RSVPInsert = {
        id: rsvpId,
        event_id: eventId,
        user_id: user.id,
        guests_count: input.guests_count,
        potluck_category: input.potluck_category ?? null,
        specific_food_item: input.specific_food_item ?? null,
        qr_hash: qrHash,
      };

      const { data, error } = await supabase
        .from("rsvps")
        .insert(rsvpData)
        .select()
        .single();

      if (error) throw error;

      // Fire-and-forget webhook
      notifyRSVPCreated(data.id, eventId, user.id);

      return data as RSVP;
    },
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ["rsvps", eventId] });
      await queryClient.cancelQueries({ queryKey: ["my-rsvp", eventId, user?.id] });

      const previousRSVPs = queryClient.getQueryData<RSVP[]>(["rsvps", eventId]);
      const optimisticRSVP: RSVP = {
        id: "optimistic",
        event_id: eventId,
        user_id: user!.id,
        guests_count: input.guests_count,
        potluck_category: input.potluck_category ?? null,
        specific_food_item: input.specific_food_item ?? null,
        checked_in: false,
        qr_hash: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      queryClient.setQueryData<RSVP[]>(["rsvps", eventId], (old) => [...(old || []), optimisticRSVP]);
      queryClient.setQueryData<RSVP | null>(["my-rsvp", eventId, user?.id], optimisticRSVP);

      return { previousRSVPs };
    },
    onError: (_err, _input, context) => {
      if (context?.previousRSVPs) {
        queryClient.setQueryData(["rsvps", eventId], context.previousRSVPs);
      }
      queryClient.setQueryData(["my-rsvp", eventId, user?.id], null);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, user?.id] });
    },
  });

  const updateRSVP = useMutation({
    mutationFn: async (input: {
      rsvpId: string;
      guests_count: number;
      potluck_category?: PotluckCategory | null;
      specific_food_item?: string | null;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("rsvps")
        .update({
          guests_count: input.guests_count,
          potluck_category: input.potluck_category ?? null,
          specific_food_item: input.specific_food_item ?? null,
        })
        .eq("id", input.rsvpId)
        .eq("user_id", user.id)
        .select()
        .single();

      if (error) throw error;
      notifyRSVPUpdated(data.id, eventId, user.id);
      return data as RSVP;
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, user?.id] });
    },
  });

  const cancelRSVP = useMutation({
    mutationFn: async (rsvpId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("rsvps")
        .delete()
        .eq("id", rsvpId)
        .eq("user_id", user.id);

      if (error) throw error;
      notifyRSVPCancelled(rsvpId, eventId, user.id);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ["rsvps", eventId] });
      const previousRSVPs = queryClient.getQueryData<RSVP[]>(["rsvps", eventId]);
      queryClient.setQueryData<RSVP[]>(["rsvps", eventId], (old) =>
        (old || []).filter((r) => r.user_id !== user?.id)
      );
      queryClient.setQueryData(["my-rsvp", eventId, user?.id], null);
      return { previousRSVPs };
    },
    onError: (_err, _id, context) => {
      if (context?.previousRSVPs) {
        queryClient.setQueryData(["rsvps", eventId], context.previousRSVPs);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, user?.id] });
    },
  });

  return { createRSVP, updateRSVP, cancelRSVP };
}
