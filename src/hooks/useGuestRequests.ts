import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
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
    mutationFn: async (input: { guest_name: string; guest_email: string; guest_phone?: string; member_note?: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("guest_requests")
        .insert({
          event_id: eventId,
          requesting_user_id: user.id,
          guest_name: input.guest_name,
          guest_email: input.guest_email,
          guest_phone: input.guest_phone || null,
          member_note: input.member_note?.trim() || null,
        } as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-guest-requests", eventId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-guest-requests-batch"] });
    },
  });
}

/** Member: cancel (delete) their own guest request */
export function useCancelGuestRequest(eventId: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("guest_requests")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-guest-requests", eventId, user?.id] });
      queryClient.invalidateQueries({ queryKey: ["my-guest-requests-batch"] });
      queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
      queryClient.invalidateQueries({ queryKey: ["pending-guest-requests-count"] });
    },
  });
}



/** Batch-fetch the current user's guest requests across many events and hydrate per-event caches. */
export function useBatchMyGuestRequests(eventIds: string[]) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["my-guest-requests-batch", user?.id, eventIds],
    enabled: !!user && eventIds.length > 0,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*")
        .eq("requesting_user_id", user!.id)
        .in("event_id", eventIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      const byEvent: Record<string, typeof data> = {};
      for (const eid of eventIds) byEvent[eid] = [];
      for (const r of data) {
        (byEvent[r.event_id] ||= []).push(r);
      }
      for (const eid of eventIds) {
        queryClient.setQueryData(["my-guest-requests", eid, user!.id], byEvent[eid]);
      }
      return data;
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
    mutationFn: async ({
      id,
      status,
      guestEmail,
      guestName,
      eventTitle,
      eventDate,
      eventLocation,
      eventAddress,
      mapUrl,
      eventLink,
      requestedByName,
      requestedByEmail,
    }: {
      id: string;
      status: "approved" | "rejected";
      guestEmail?: string;
      guestName?: string;
      eventTitle?: string;
      eventDate?: string;
      eventLocation?: string;
      eventAddress?: string;
      mapUrl?: string;
      eventLink?: string;
      requestedByName?: string;
      requestedByEmail?: string;
    }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;

      // Send email to guest when approved
      if (status === "approved" && guestEmail) {
        try {
          await supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "guest-approved",
              recipientEmail: guestEmail,
              templateData: {
                guestName: guestName || "Guest",
                eventTitle: eventTitle || "Event",
                eventDate: eventDate || "",
                eventLocation: eventLocation || "",
                eventAddress: eventAddress || "",
                mapUrl: mapUrl || "",
                eventLink: eventLink || "",
                requestedBy: requestedByName || "",
              },
            },
          });
        } catch (emailErr) {
          console.error("Failed to send guest approved email:", emailErr);
        }
      }


      // Fire webhook on rejection (deliberately excludes guest_email)
      if (status === "rejected") {
        try {
          await supabase.functions.invoke("notify-guest-rejected", {
            body: {
              guest_name: guestName || "Guest",
              event_title: eventTitle || "Event",
              requesting_user_name: requestedByName || "Member",
              requesting_user_email: requestedByEmail || "",
            },
          });
        } catch (webhookErr) {
          console.error("Failed to trigger rejection webhook:", webhookErr);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
      queryClient.invalidateQueries({ queryKey: ["all-guest-requests"] });
    },
  });
}
