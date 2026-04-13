import { useCallback } from "react";
import { NavLink } from "react-router-dom";
import { Home, User, Shield, BookOpen } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";
import { prefetchHome, prefetchLibrary, prefetchAdmin, prefetchProfile } from "@/lib/prefetch";

export default function BottomNav() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";
  const { data: pendingCount } = usePendingUsersCount();

  const handlePrefetch = useCallback(
    (to: string) => {
      switch (to) {
        case "/":
          prefetchHome(queryClient);
          break;
        case "/library":
          prefetchLibrary(queryClient);
          break;
        case "/admin":
          prefetchAdmin(queryClient);
          break;
        case "/profile":
          prefetchProfile(queryClient, user?.id);
          break;
      }
    },
    [queryClient, user?.id]
  );

  const tabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/library", icon: BookOpen, label: "Library" },
    ...((isAdmin || isModerator) ? [{ to: "/admin", icon: Shield, label: isAdmin ? "Admin" : "Manage", showBadge: isAdmin }] : []),
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
            onMouseEnter={() => handlePrefetch(to)}
            onFocus={() => handlePrefetch(to)}
            onTouchStart={() => handlePrefetch(to)}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-3 text-xs transition-colors ${
                isActive
                  ? "text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <span className="relative">
              <Icon className="h-5 w-5" />
              {showBadge && !!pendingCount && pendingCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-pulse">
                  {pendingCount > 99 ? "99+" : pendingCount}
                </span>
              )}
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
