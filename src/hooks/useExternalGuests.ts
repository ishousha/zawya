import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";

export interface ExternalGuest {
  id: string;
  owner_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  times_invited: number;
  times_approved: number;
  times_attended: number;
  last_invited_at: string | null;
  last_attended_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Current user's saved external guests. */
export function useMyExternalGuests() {
  const { user } = useAuth();
  return useQuery<ExternalGuest[]>({
    queryKey: ["my-external-guests", user?.id],
    enabled: !!user,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_guests" as any)
        .select("*")
        .eq("owner_id", user!.id)
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ExternalGuest[];
    },
  });
}

export function useUpsertExternalGuest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id?: string;
      name: string;
      email?: string | null;
      phone?: string | null;
      notes?: string | null;
    }): Promise<ExternalGuest> => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        owner_id: user.id,
        name: input.name.trim(),
        email: input.email?.trim() || null,
        phone: input.phone?.trim() || null,
        notes: input.notes?.trim() || null,
      };
      if (input.id) {
        const { data, error } = await supabase
          .from("external_guests" as any)
          .update(payload)
          .eq("id", input.id)
          .select()
          .single();
        if (error) throw error;
        return data as unknown as ExternalGuest;
      }
      const { data, error } = await supabase
        .from("external_guests" as any)
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as ExternalGuest;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-external-guests", user?.id] });
      qc.invalidateQueries({ queryKey: ["admin-external-guests"] });
    },
  });
}

export function useDeleteExternalGuest() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("external_guests" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-external-guests", user?.id] });
      qc.invalidateQueries({ queryKey: ["admin-external-guests"] });
    },
  });
}

/** Admin: all saved guests across the community, joined with owner profile. */
export function useAdminExternalGuests() {
  return useQuery({
    queryKey: ["admin-external-guests"],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("external_guests" as any)
        .select("*, owner:owner_id(id, name, email)")
        .order("times_invited", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

/** Admin: full request history for a saved guest. */
export function useExternalGuestHistory(guestId: string | null) {
  return useQuery({
    queryKey: ["external-guest-history", guestId],
    enabled: !!guestId,
    queryFn: async () => {
      const { data: requests, error } = await (supabase
        .from("guest_requests") as any)
        .select("id, status, created_at, guest_name, event_id")
        .eq("external_guest_id", guestId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const eventIds = Array.from(new Set(((requests ?? []) as any[]).map((r: any) => r.event_id).filter(Boolean))) as string[];
      let eventsById: Record<string, { id: string; title: string; date_time: string }> = {};
      if (eventIds.length > 0) {
        const { data: events } = await supabase
          .from("events")
          .select("id, title, date_time")
          .in("id", eventIds);
        for (const e of events ?? []) eventsById[e.id] = e as any;
      }
      return (requests ?? []).map((r: any) => ({ ...r, event: eventsById[r.event_id] ?? null }));
    },
  });
}
