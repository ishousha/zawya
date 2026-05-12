import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/runtime-client";
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
      (_event, newSession) => {
        if (!initialDone) return;
        if (!mounted) return;

        const prevUserId = sessionRef.current?.user?.id;
        const newUserId = newSession?.user?.id;

        setSession(newSession);
        sessionRef.current = newSession;

        if (newSession?.user) {
          if (newUserId !== prevUserId) {
            setLoading(true);
            // Defer async DB call to avoid deadlocking the Supabase auth lock,
            // which causes the first save/update after auth events to hang.
            setTimeout(() => {
              if (!mounted) return;
              fetchProfile(newSession.user.id).finally(() => {
                if (mounted) setLoading(false);
              });
            }, 0);
          } else {
            // Same user — token refresh etc. Refresh profile in background, don't block.
            setTimeout(() => {
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
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, loading, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}
