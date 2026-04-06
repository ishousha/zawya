import { Button } from "@/components/ui/button";
import { ShieldOff } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Suspended() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldOff className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Account Suspended
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your account has been suspended by an administrator. If you believe
            this is a mistake, please reach out to the community admin for
            assistance.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
