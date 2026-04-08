import { NavLink } from "react-router-dom";
import { Home, User, Shield, BookOpen, Mic } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { usePendingUsersCount } from "@/hooks/usePendingUsersCount";

export default function BottomNav() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";
  const { data: pendingCount } = usePendingUsersCount();

  const tabs = [
    { to: "/", icon: Home, label: "Home" },
    { to: "/speakers", icon: Mic, label: "Speakers" },
    { to: "/library", icon: BookOpen, label: "Library" },
    ...((isAdmin || isModerator) ? [{ to: "/admin", icon: Shield, label: isAdmin ? "Admin" : "Manage", showBadge: isAdmin }] : []),
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, icon: Icon, label, showBadge }) => (
          <NavLink
            key={to}
            to={to}
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
