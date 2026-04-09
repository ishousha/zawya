import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, CheckCircle2, Mail, Chrome } from "lucide-react";
import { toast } from "sonner";
import type { UserIdentity } from "@supabase/supabase-js";

const PROVIDER_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email / Password", icon: Mail },
  google: { label: "Google", icon: Chrome },
};

export default function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  const fetchIdentities = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      console.warn("Failed to fetch identities:", error);
    } else {
      setIdentities(data.identities ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchIdentities();
  }, [fetchIdentities]);

  const linkedProviders = new Set(identities.map((i) => i.provider));

  const handleLinkGoogle = async () => {
    setLinking("google");
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: window.location.origin + "/profile" },
      });
      if (error) throw error;
    } catch (err: any) {
      const msg = err?.message || "Failed to link account";
      if (msg.includes("already linked") || msg.includes("identity_already_exists")) {
        toast.error("This account is already linked to another user.");
      } else {
        toast.error(msg);
      }
      setLinking(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary" />
        <h3 className="font-heading text-lg font-semibold text-card-foreground">Linked Accounts</h3>
      </div>
      <p className="text-xs text-muted-foreground">
        Link multiple sign-in methods to prevent duplicate accounts.
      </p>

      <div className="space-y-2">
        {identities.map((identity) => {
          const meta = PROVIDER_META[identity.provider] ?? { label: identity.provider, icon: Link2 };
          const Icon = meta.icon;
          return (
            <div
              key={identity.id}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                <Icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{meta.label}</span>
                {identity.identity_data?.email && (
                  <span className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {identity.identity_data.email as string}
                  </span>
                )}
              </div>
              <Badge variant="outline" className="gap-1 text-xs">
                <CheckCircle2 className="h-3 w-3 text-primary" />
                Connected
              </Badge>
            </div>
          );
        })}
      </div>

      {!linkedProviders.has("google") && (
        <Button
          variant="outline"
          className="w-full justify-start gap-2"
          onClick={handleLinkGoogle}
          disabled={linking === "google"}
        >
          {linking === "google" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Chrome className="h-4 w-4" />
          )}
          Link Google Account
        </Button>
      )}

      {linkedProviders.has("google") && linkedProviders.has("email") && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          All supported sign-in methods are linked ✓
        </p>
      )}
    </div>
  );
}
