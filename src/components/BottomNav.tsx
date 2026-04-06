import { NavLink } from "react-router-dom";
import { Home, User, Shield } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function BottomNav() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";
  const isModerator = (profile?.role as string) === "moderator";

  const tabs = [
    { to: "/", icon: Home, label: "Home" },
    ...((isAdmin || isModerator) ? [{ to: "/admin", icon: Shield, label: isAdmin ? "Admin" : "Manage" }] : []),
    { to: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card">
      <div className="mx-auto flex max-w-lg">
        {tabs.map(({ to, icon: Icon, label }) => (
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
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
