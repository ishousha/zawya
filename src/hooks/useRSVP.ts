import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { generateQRHash } from "@/lib/qr-hash";
import { notifyRSVPCreated, notifyRSVPUpdated, notifyRSVPCancelled } from "@/lib/webhooks";
import { removeCachedTicket } from "@/lib/offline-ticket-cache";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type RSVPInsert = Database["public"]["Tables"]["rsvps"]["Insert"];

export function useEventRSVPs(eventId: string) {
  return useQuery({
    queryKey: ["rsvps", eventId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
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
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from("rsvps")
        .select("*")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .neq("status", "cancelled")
        .maybeSingle();
      if (error) throw error;
      return data as RSVP | null;
    },
    enabled: !!user,
  });
}

/** Legacy — kept for backward compat but prefer useSignUpItems */
export function usePotluckConfig(eventId: string) {
  return useQuery({
    queryKey: ["potluck-config", eventId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
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

/** Fetch flexible sign-up items for an event */
export function useSignUpItems(eventId: string) {
  return useQuery({
    queryKey: ["sign-up-items", eventId],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_sign_up_items")
        .select("*")
        .eq("event_id", eventId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** Fetch all selections for an event (across all RSVPs) */
export function useEventSelections(eventId: string) {
  return useQuery({
    queryKey: ["event-selections", eventId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      // Fetch RSVPs and selections in parallel once we have rsvp IDs
      const { data: rsvps, error: rsvpErr } = await supabase
        .from("rsvps")
        .select("id")
        .eq("event_id", eventId)
        .neq("status", "cancelled");
      if (rsvpErr) throw rsvpErr;
      if (!rsvps || rsvps.length === 0) return [];

      const rsvpIds = rsvps.map((r) => r.id);
      const { data, error } = await supabase
        .from("rsvp_sign_up_selections")
        .select("*")
        .in("rsvp_id", rsvpIds);
      if (error) throw error;
      return data;
    },
  });
}

/** Fetch my selections for a specific RSVP */
export function useMySelections(rsvpId: string | undefined) {
  return useQuery({
    queryKey: ["my-selections", rsvpId],
    enabled: !!rsvpId,
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvp_sign_up_selections")
        .select("*")
        .eq("rsvp_id", rsvpId!);
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Checks capacity & waitlist, returns whether the RSVP should be waitlisted.
 * Throws if both event and waitlist are full.
 */
async function checkWaitlistStatus(
  eventId: string,
  currentUserId: string
): Promise<boolean> {
  const { data: event, error: evErr } = await supabase
    .from("events")
    .select("capacity, waitlist_capacity")
    .eq("id", eventId)
    .single();
  if (evErr) throw evErr;

  const capacity = (event as any).capacity as number | null;
  const waitlistCapacity = ((event as any).waitlist_capacity ?? 0) as number;

  if (!capacity) return false;

  // Count existing attending RSVPs (using status column)
  const { count: confirmedCount, error: cErr } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "attending")
    .neq("user_id", currentUserId);
  if (cErr) throw cErr;

  const confirmed = confirmedCount ?? 0;
  if (confirmed < capacity) return false;

  // Event is full — check waitlist room
  const { count: waitlistedCount, error: wErr } = await supabase
    .from("rsvps")
    .select("*", { count: "exact", head: true })
    .eq("event_id", eventId)
    .eq("status", "waitlisted")
    .neq("user_id", currentUserId);
  if (wErr) throw wErr;

  const waitlisted = waitlistedCount ?? 0;
  if (waitlisted >= waitlistCapacity) {
    throw new Error("FULL");
  }

  return true;
}

export function useRSVPConcurrency(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["rsvps", eventId] });
    queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, user?.id] });
    queryClient.invalidateQueries({ queryKey: ["event-selections", eventId] });
    queryClient.invalidateQueries({ queryKey: ["my-selections"] });
  };

  const createRSVP = useMutation({
    mutationFn: async (input: {
      guests_count: number;
      potluck_category?: string | null;
      specific_food_item?: string | null;
      attending_dependents?: Record<string, any>[] | null;
      selections?: { sign_up_item_id: number; quantity: number; description?: string | null }[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const isWaitlisted = await checkWaitlistStatus(eventId, user.id);

      const rsvpId = crypto.randomUUID();
      const qrHash = await generateQRHash(rsvpId);

      const rsvpData: RSVPInsert = {
        id: rsvpId,
        event_id: eventId,
        user_id: user.id,
        guests_count: input.guests_count,
        potluck_category: (input.potluck_category as any) ?? null,
        specific_food_item: input.specific_food_item ?? null,
        qr_hash: qrHash,
        is_waitlisted: isWaitlisted,
        status: isWaitlisted ? "waitlisted" : "attending",
        attending_dependents: input.attending_dependents ?? null,
      };

      const { data, error } = await supabase
        .from("rsvps")
        .insert(rsvpData)
        .select()
        .single();
      if (error) throw error;

      // Save selections
      if (input.selections && input.selections.length > 0) {
        const rows = input.selections.map((s) => ({
          rsvp_id: data.id,
          sign_up_item_id: s.sign_up_item_id,
          quantity: s.quantity,
          description: s.description ?? null,
        } as any));
        const { error: selErr } = await supabase.from("rsvp_sign_up_selections").insert(rows);
        if (selErr) throw selErr;
      }

      notifyRSVPCreated(data.id, eventId, user.id);

      // Send RSVP confirmation email
      (async () => {
        try {
          const [{ data: profile }, { data: event }] = await Promise.all([
            supabase
              .from("profiles")
              .select("email, name")
              .eq("id", user.id)
              .maybeSingle(),
            supabase
              .from("events")
              .select("title, date_time, location, address")
              .eq("id", eventId)
              .maybeSingle(),
          ]);
          if (profile?.email && event) {
            const eventDate = new Date(event.date_time).toLocaleString("en-US", {
              weekday: "long", year: "numeric", month: "long", day: "numeric",
              hour: "numeric", minute: "2-digit",
            });
            const eventLocation = event.location
              ? `${event.location}${event.address ? ` — ${event.address}` : ""}`
              : "";
            await supabase.functions.invoke("send-transactional-email", {
              body: {
                templateName: "rsvp-confirmation",
                recipientEmail: profile.email,
                idempotencyKey: `rsvp-confirm-${data.id}`,
                templateData: {
                  memberName: profile.name || undefined,
                  eventTitle: event.title,
                  eventDate,
                  eventLocation,
                  guestsCount: input.guests_count,
                  isWaitlisted,
                },
              },
            });
          }
        } catch (e) {
          console.warn("Failed to send RSVP confirmation email:", e);
        }
      })();

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
        potluck_category: (input.potluck_category as any) ?? null,
        specific_food_item: input.specific_food_item ?? null,
        attending_dependents: input.attending_dependents ?? null,
        checked_in: false,
        is_waitlisted: false,
        status: "attending",
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
    onSettled: invalidateAll,
  });

  const updateRSVP = useMutation({
    mutationFn: async (input: {
      rsvpId: string;
      guests_count: number;
      potluck_category?: string | null;
      specific_food_item?: string | null;
      attending_dependents?: Record<string, any>[] | null;
      selections?: { sign_up_item_id: number; quantity: number; description?: string | null }[];
    }) => {
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("rsvps")
        .update({
          guests_count: input.guests_count,
          potluck_category: (input.potluck_category as any) ?? null,
          specific_food_item: input.specific_food_item ?? null,
          attending_dependents: input.attending_dependents ?? null,
        })
        .eq("id", input.rsvpId)
        .eq("user_id", user.id)
        .select()
        .single();
      if (error) throw error;

      // Replace selections
      await supabase.from("rsvp_sign_up_selections").delete().eq("rsvp_id", input.rsvpId);
      if (input.selections && input.selections.length > 0) {
        const rows = input.selections.map((s) => ({
          rsvp_id: input.rsvpId,
          sign_up_item_id: s.sign_up_item_id,
          quantity: s.quantity,
          description: s.description ?? null,
        } as any));
        const { error: selErr } = await supabase.from("rsvp_sign_up_selections").insert(rows);
        if (selErr) throw selErr;
      }

      notifyRSVPUpdated(data.id, eventId, user.id);
      return data as RSVP;
    },
    onSettled: invalidateAll,
  });

  const cancelRSVP = useMutation({
    mutationFn: async (rsvpId: string) => {
      if (!user) throw new Error("Not authenticated");

      // Release claimed sign-up items first
      await supabase.from("rsvp_sign_up_selections").delete().eq("rsvp_id", rsvpId);

      // Soft-cancel: update status to 'cancelled' instead of deleting
      const { error } = await supabase
        .from("rsvps")
        .update({ status: "cancelled" as any, is_waitlisted: false })
        .eq("id", rsvpId)
        .eq("user_id", user.id);
      if (error) throw error;

      removeCachedTicket(rsvpId);
      notifyRSVPCancelled(rsvpId, eventId, user.id);

      // The DB trigger `promote_waitlisted_on_cancel` handles auto-promotion + notification
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
    onSettled: invalidateAll,
  });

  return { createRSVP, updateRSVP, cancelRSVP };
}
