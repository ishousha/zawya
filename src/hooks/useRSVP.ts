import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";
import { generateQRHash } from "@/lib/qr-hash";
import { notifyRSVPCreated, notifyRSVPUpdated, notifyRSVPCancelled } from "@/lib/webhooks";
import { removeCachedTicket } from "@/lib/offline-ticket-cache";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type RSVP = Database["public"]["Tables"]["rsvps"]["Row"];
type RSVPInsert = Database["public"]["Tables"]["rsvps"]["Insert"];

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

export function useEventRsvpCounts(eventId: string) {
  return useQuery({
    queryKey: ["rsvp-counts", eventId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_rsvp_counts", { _event_id: eventId });
      if (error) throw error;
      const row = (data as any[])?.[0];
      return {
        attending_count: row?.attending_count ?? 0,
        attending_rsvp_count: row?.attending_rsvp_count ?? 0,
        waitlisted_count: row?.waitlisted_count ?? 0,
        checked_in_count: row?.checked_in_count ?? 0,
      };
    },
    enabled: !!eventId,
  });
}

export function useEventSignUpClaims(eventId: string) {
  return useQuery({
    queryKey: ["signup-claims", eventId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_event_signup_claims", { _event_id: eventId });
      if (error) throw error;
      return (data as { sign_up_item_id: number; total_quantity: number }[]) ?? [];
    },
    enabled: !!eventId,
  });
}

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

export function useEventSelections(eventId: string) {
  return useQuery({
    queryKey: ["event-selections", eventId],
    staleTime: 2 * 60 * 1000,
    gcTime: 5 * 60 * 1000,
    queryFn: async () => {
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

async function checkWaitlistStatus(
  eventId: string,
  currentUserId: string,
  requestedGuests: number,
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

  const { data: confirmedRows, error: cErr } = await supabase
    .from("rsvps")
    .select("guests_count")
    .eq("event_id", eventId)
    .eq("status", "attending")
    .neq("user_id", currentUserId);
  if (cErr) throw cErr;

  const confirmed = (confirmedRows ?? []).reduce(
    (sum, r: any) => sum + (r.guests_count ?? 1),
    0
  );
  if (confirmed + requestedGuests <= capacity) return false;

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
    queryClient.invalidateQueries({ queryKey: ["rsvp-counts", eventId] });
    queryClient.invalidateQueries({ queryKey: ["signup-claims", eventId] });
    queryClient.invalidateQueries({ queryKey: ["my-rsvp", eventId, user?.id] });
    queryClient.invalidateQueries({ queryKey: ["event-selections", eventId] });
    queryClient.invalidateQueries({ queryKey: ["my-selections"] });
    queryClient.invalidateQueries({ queryKey: ["potluck-menu", eventId] });
    queryClient.invalidateQueries({ queryKey: ["potluck-signup-items", eventId] });
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const createRSVP = useMutation({
    mutationFn: async (input: {
      guests_count: number;
      potluck_category?: string | null;
      specific_food_item?: string | null;
      attending_dependents?: Record<string, any>[] | null;
      selections?: { sign_up_item_id: number; quantity: number; description?: string | null }[];
      forceAttending?: boolean;
    }) => {
      if (!user) throw new Error("Not authenticated");

      const isWaitlisted = input.forceAttending
        ? false
        : await checkWaitlistStatus(eventId, user.id, input.guests_count);
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

      // Check for existing RSVP (including cancelled) — unique constraint is on (event_id, user_id)
      const { data: existing } = await supabase
        .from("rsvps")
        .select("id")
        .eq("event_id", eventId)
        .eq("user_id", user.id)
        .maybeSingle();

      let data: RSVP;
      if (existing) {
        const { data: updated, error: updErr } = await supabase
          .from("rsvps")
          .update({
            guests_count: rsvpData.guests_count,
            potluck_category: rsvpData.potluck_category,
            specific_food_item: rsvpData.specific_food_item,
            qr_hash: qrHash,
            is_waitlisted: isWaitlisted,
            status: rsvpData.status,
            attending_dependents: rsvpData.attending_dependents,
          })
          .eq("id", existing.id)
          .select()
          .single();
        if (updErr) throw updErr;
        data = updated as RSVP;
        // Clear any old selections from prior RSVP
        await supabase.from("rsvp_sign_up_selections").delete().eq("rsvp_id", existing.id);
      } else {
        const { data: inserted, error } = await supabase
          .from("rsvps")
          .insert(rsvpData)
          .select()
          .single();
        if (error) throw error;
        data = inserted as RSVP;
      }

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
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err, _input, context) => {
      if (context?.previousRSVPs) {
        queryClient.setQueryData(["rsvps", eventId], context.previousRSVPs);
      }
      queryClient.setQueryData(["my-rsvp", eventId, user?.id], null);
      toast.error(getErrorMessage(err, "Failed to create RSVP"));
    },
    onSettled: () => {},
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

      // Capacity guard: if increasing guests, ensure new party still fits.
      const { data: existingRow, error: existingErr } = await supabase
        .from("rsvps")
        .select("guests_count, status")
        .eq("id", input.rsvpId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existingErr) throw existingErr;

      const prevGuests = existingRow?.guests_count ?? 0;
      const isAttending = existingRow?.status === "attending";
      if (isAttending && input.guests_count > prevGuests) {
        const { data: ev, error: evErr } = await supabase
          .from("events")
          .select("capacity")
          .eq("id", eventId)
          .single();
        if (evErr) throw evErr;
        const capacity = (ev as any).capacity as number | null;
        if (capacity) {
          const { data: otherRows, error: oErr } = await supabase
            .from("rsvps")
            .select("guests_count")
            .eq("event_id", eventId)
            .eq("status", "attending")
            .neq("user_id", user.id);
          if (oErr) throw oErr;
          const confirmedOthers = (otherRows ?? []).reduce(
            (sum, r: any) => sum + (r.guests_count ?? 1),
            0
          );
          const remaining = capacity - confirmedOthers;
          if (input.guests_count > remaining) {
            throw new Error(`Not enough seats — only ${Math.max(0, remaining)} spots remaining`);
          }
        }
      }

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

      const { error: deleteSelectionsError } = await supabase.from("rsvp_sign_up_selections").delete().eq("rsvp_id", input.rsvpId);
      if (deleteSelectionsError) throw deleteSelectionsError;

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
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err) => {
      toast.error(getErrorMessage(err, "Failed to update RSVP"));
    },
    onSettled: () => {},
  });

  const cancelRSVP = useMutation({
    mutationFn: async (rsvpId: string) => {
      if (!user) throw new Error("Not authenticated");

      const { error: deleteSelectionsError } = await supabase.from("rsvp_sign_up_selections").delete().eq("rsvp_id", rsvpId);
      if (deleteSelectionsError) throw deleteSelectionsError;

      const { error } = await supabase
        .from("rsvps")
        .update({ status: "cancelled" as any, is_waitlisted: false })
        .eq("id", rsvpId)
        .eq("user_id", user.id);
      if (error) throw error;

      removeCachedTicket(rsvpId);
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
    onSuccess: () => {
      invalidateAll();
    },
    onError: (err, _id, context) => {
      if (context?.previousRSVPs) {
        queryClient.setQueryData(["rsvps", eventId], context.previousRSVPs);
      }
      toast.error(getErrorMessage(err, "Failed to cancel RSVP"));
    },
    onSettled: () => {},
  });

  return { createRSVP, updateRSVP, cancelRSVP };
}
