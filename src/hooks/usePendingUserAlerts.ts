import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Subscribes to realtime INSERT events on the profiles table.
 * When a new pending user appears, shows a toast to admin users
 * and invalidates the pending-users-count query.
 */
export function usePendingUserAlerts() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const channel = supabase
      .channel("pending-user-alerts")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "profiles",
          filter: "role=eq.pending",
        },
        (payload) => {
          const newUser = payload.new as { name?: string; email?: string };
          const displayName = newUser.name?.trim() || newUser.email || "Someone";

          toast.info(`New sign-up: ${displayName}`, {
            description: "Awaiting your approval",
            action: {
              label: "Review",
              onClick: () => {
                window.location.hash = "";
                window.location.pathname = "/admin";
              },
            },
            duration: 8000,
          });

          // Refresh badge counts and user list
          queryClient.invalidateQueries({ queryKey: ["pending-users-count"] });
          queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isAdmin, queryClient]);
}
