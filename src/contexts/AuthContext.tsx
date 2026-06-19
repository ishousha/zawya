import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useQueryClient } from "@tanstack/react-query";
import type { Database } from "@/integrations/supabase/types";


type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();
    setProfile(data);
    return data;
  };

  // Track session in a ref so the profile-updated listener always has the current value
  const sessionRef = React.useRef<Session | null>(null);

  useEffect(() => {
    let mounted = true;
    let initialDone = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        if (!initialDone) return;
        if (!mounted) return;

        const prevUserId = sessionRef.current?.user?.id;
        const prevEmail = sessionRef.current?.user?.email;
        const newUserId = newSession?.user?.id;

        setSession(newSession);
        sessionRef.current = newSession;

        if (newSession?.user) {
          if (newUserId !== prevUserId) {
            if (prevUserId) queryClient.clear();
            setLoading(true);
            setTimeout(() => {
              if (!mounted) return;
              fetchProfile(newSession.user.id).finally(() => {
                if (mounted) setLoading(false);
              });
            }, 0);
          } else {
            // Same user — token refresh, USER_UPDATED (e.g. confirmed email change), etc.
            const authEmail = newSession.user.email;
            const emailChanged =
              event === "USER_UPDATED" && authEmail && authEmail !== prevEmail;
            setTimeout(async () => {
              if (!mounted) return;
              // Keep profiles.email in sync with the auth email after a confirmed change.
              if (emailChanged) {
                await supabase
                  .from("profiles")
                  .update({ email: authEmail })
                  .eq("id", newSession.user.id);
              }
              if (mounted) fetchProfile(newSession.user.id);
            }, 0);
            if (mounted) setLoading(false);
          }
        } else {
          setProfile(null);
          if (mounted) setLoading(false);
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session: initSession } }) => {
      if (!mounted) return;
      setSession(initSession);
      sessionRef.current = initSession;
      if (initSession?.user) {
        await fetchProfile(initSession.user.id);
      }
      if (mounted) {
        setLoading(false);
        initialDone = true;
      }
    });

    // Listen for profile updates (e.g. avatar change, terms acceptance)
    const handleProfileUpdate = () => {
      const userId = sessionRef.current?.user?.id;
      if (userId) fetchProfile(userId);
    };
    window.addEventListener("profile-updated", handleProfileUpdate);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("profile-updated", handleProfileUpdate);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setProfile(null);
    // Clear all cached query data so a different user (or fresh login)
    // never sees stale counts/dashboards from the previous session.
    queryClient.clear();
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
