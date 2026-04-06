import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

export default function Rejected() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="mx-auto max-w-sm text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <XCircle className="h-8 w-8 text-destructive" />
        </div>
        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Account Declined
          </h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Unfortunately, we are unable to approve your access to the Zawya app
            at this time. If you believe this is a mistake, please contact an
            administrator.
          </p>
        </div>
        <Button variant="outline" className="w-full" onClick={signOut}>
          Sign Out
        </Button>
      </div>
    </div>
  );
}
