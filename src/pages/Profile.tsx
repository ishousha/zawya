import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { LogOut, User } from "lucide-react";

export default function ProfilePage() {
  const { profile, user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Profile</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6">
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold text-card-foreground">
                {profile?.name || "Community Member"}
              </h2>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>

          {profile?.family_name && (
            <div className="mb-3 text-sm">
              <span className="text-muted-foreground">Family: </span>
              <span className="text-card-foreground">{profile.family_name}</span>
            </div>
          )}

          {profile?.phone && (
            <div className="mb-3 text-sm">
              <span className="text-muted-foreground">Phone: </span>
              <span className="text-card-foreground">{profile.phone}</span>
            </div>
          )}

          <div className="text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
              {profile?.role}
            </span>
          </div>
        </div>

        <Button
          variant="outline"
          className="mt-6 w-full"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </main>
    </div>
  );
}
