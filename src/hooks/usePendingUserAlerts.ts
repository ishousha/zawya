import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

const STORAGE_KEY = "pending-user-dismiss-counts";
const MAX_DISMISSALS = 3;
const RESHOW_INTERVAL = 30_000; // re-show every 30s if not dismissed enough

function getDismissals(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function incrementDismissal(userId: string) {
  const counts = getDismissals();
  counts[userId] = (counts[userId] || 0) + 1;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  return counts[userId];
}

function isDismissedEnough(userId: string): boolean {
  return (getDismissals()[userId] || 0) >= MAX_DISMISSALS;
}

export function usePendingUserAlerts() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingAlertsRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  const showAlert = useCallback((userId: string, displayName: string) => {
    if (isDismissedEnough(userId)) return;

    toast.info(`New sign-up: ${displayName}`, {
      description: "Awaiting your approval",
      action: {
        label: "Review",
        onClick: () => {
          // Mark as fully dismissed when acted upon
          const counts = getDismissals();
          counts[userId] = MAX_DISMISSALS;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
          // Clear interval
          const interval = pendingAlertsRef.current.get(userId);
          if (interval) {
            clearInterval(interval);
            pendingAlertsRef.current.delete(userId);
          }
          window.location.pathname = "/admin";
        },
      },
      duration: 10000,
      onDismiss: () => {
        const count = incrementDismissal(userId);
        if (count >= MAX_DISMISSALS) {
          const interval = pendingAlertsRef.current.get(userId);
          if (interval) {
            clearInterval(interval);
            pendingAlertsRef.current.delete(userId);
          }
        }
      },
    });
  }, []);

  useEffect(() => {
    if (!isAdmin) return;

    // On mount, check for existing pending users and show alerts
    const checkExisting = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("role", "pending");

      if (data) {
        for (const user of data) {
          const uid = user.id;
          if (isDismissedEnough(uid)) continue;
          const displayName = user.name?.trim() || user.email || "Someone";
          showAlert(uid, displayName);

          // Set up recurring alert
          if (!pendingAlertsRef.current.has(uid)) {
            const interval = setInterval(() => {
              if (isDismissedEnough(uid)) {
                clearInterval(interval);
                pendingAlertsRef.current.delete(uid);
                return;
              }
              showAlert(uid, displayName);
            }, RESHOW_INTERVAL);
            pendingAlertsRef.current.set(uid, interval);
          }
        }
      }
    };
    checkExisting();

    // Listen for new pending users
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
          const newUser = payload.new as { id: string; name?: string; email?: string };
          const displayName = newUser.name?.trim() || newUser.email || "Someone";

          showAlert(newUser.id, displayName);

          // Set up recurring alert for this user
          if (!pendingAlertsRef.current.has(newUser.id)) {
            const interval = setInterval(() => {
              if (isDismissedEnough(newUser.id)) {
                clearInterval(interval);
                pendingAlertsRef.current.delete(newUser.id);
                return;
              }
              showAlert(newUser.id, displayName);
            }, RESHOW_INTERVAL);
            pendingAlertsRef.current.set(newUser.id, interval);
          }

          queryClient.invalidateQueries({ queryKey: ["pending-users-count"] });
          queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      // Clear all intervals
      pendingAlertsRef.current.forEach((interval) => clearInterval(interval));
      pendingAlertsRef.current.clear();
    };
  }, [isAdmin, queryClient, showAlert]);
}
