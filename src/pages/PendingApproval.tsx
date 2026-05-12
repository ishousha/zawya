import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/runtime-client";

export default function PendingApproval() {
  const { signOut, profile, user } = useAuth();

  // Subscribe to realtime updates on this user's profile row
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`pending-approval-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "profiles",
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newRole = (payload.new as any)?.role;
          if (newRole && newRole !== "pending" && newRole !== "suspended" && newRole !== "rejected") {
            // Profile was approved — trigger a refresh of auth context
            window.dispatchEvent(new Event("profile-updated"));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in text-center">
        {/* Pulsing hourglass */}
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-accent animate-pulse">
          <span className="font-heading text-2xl text-accent-foreground">⏳</span>
        </div>
        <h1 className="font-heading text-2xl font-bold text-foreground">
          Pending Approval
        </h1>
        <p className="mt-3 text-muted-foreground">
          Welcome{profile?.name ? `, ${profile.name}` : ""}! Your account is awaiting
          admin approval. You'll receive access once approved.
        </p>
        <p className="mt-2 text-xs text-muted-foreground/70">
          This page will update automatically — no need to refresh.
        </p>
        <button
          onClick={signOut}
          className="mt-6 text-sm text-primary underline underline-offset-2 hover:text-emerald-light"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
