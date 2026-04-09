import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Link2, CheckCircle2, Mail, Phone, Chrome, Apple } from "lucide-react";
import { toast } from "sonner";
import type { UserIdentity } from "@supabase/supabase-js";

const PROVIDER_META: Record<string, { label: string; icon: typeof Mail }> = {
  email: { label: "Email / Password", icon: Mail },
  google: { label: "Google", icon: Chrome },
  apple: { label: "Apple", icon: Apple },
  phone: { label: "Phone", icon: Phone },
};

export default function LinkedAccounts() {
  const [identities, setIdentities] = useState<UserIdentity[]>([]);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState<string | null>(null);

  // Phone linking state
  const [phoneStep, setPhoneStep] = useState<"idle" | "enter" | "verify">("idle");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);

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

  const handleLinkOAuth = async (provider: "google" | "apple") => {
    setLinking(provider);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider,
        options: { redirectTo: window.location.origin + "/profile" },
      });
      if (error) throw error;
      // Will redirect — no need to handle success here
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

  const handleSendPhoneOtp = async () => {
    if (!phoneNumber.trim()) {
      toast.error("Please enter a phone number.");
      return;
    }
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneNumber.trim(),
      });
      if (error) throw error;
      setPhoneStep("verify");
      toast.success("OTP sent to " + phoneNumber);
    } catch (err: any) {
      toast.error(err?.message || "Failed to send OTP");
    }
    setPhoneLoading(false);
  };

  const handleVerifyPhoneOtp = async () => {
    if (!otp.trim()) {
      toast.error("Please enter the OTP code.");
      return;
    }
    setPhoneLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        phone: phoneNumber.trim(),
        token: otp.trim(),
        type: "phone_change",
      });
      if (error) throw error;
      toast.success("Phone number linked successfully!");
      setPhoneStep("idle");
      setPhoneNumber("");
      setOtp("");
      fetchIdentities();
    } catch (err: any) {
      toast.error(err?.message || "Failed to verify OTP");
    }
    setPhoneLoading(false);
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

      {/* Current identities */}
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

      {/* Link buttons for unlinked providers */}
      <div className="space-y-2 pt-2">
        {!linkedProviders.has("google") && (
          <Button
            variant="outline"
            className="w-full justify-start gap-2"
            onClick={() => handleLinkOAuth("google")}
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

      </div>

      {linkedProviders.size >= 3 && (
        <p className="text-xs text-muted-foreground text-center pt-1">
          All supported sign-in methods are linked ✓
        </p>
      )}
    </div>
  );
}
