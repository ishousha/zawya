import { Link } from "react-router-dom";
import zawyaLogo from "@/assets/zawya-logo.png";
import NotificationBell from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

export default function AppHeader() {
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/50 bg-background/95 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <Link to="/" className="flex items-center gap-2.5">
        <img src={zawyaLogo} alt="Zawya" width={32} height={32} className="rounded-md" />
        <h1 className="font-heading text-lg font-semibold text-foreground">Zawya</h1>
      </Link>
      {user && <NotificationBell />}
    </header>
  );
}
