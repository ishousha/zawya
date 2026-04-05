import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ScrollText, ShieldCheck, EyeOff, Camera, Home, UserCheck, Lock } from "lucide-react";
import { toast } from "sonner";

interface CommunityGuidelinesProps {
  /** If true, shows as read-only (no accept flow) */
  readOnly?: boolean;
}

export default function CommunityGuidelines({ readOnly = false }: CommunityGuidelinesProps) {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleAccept = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ terms_accepted: true } as any)
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast.error("Failed to save agreement. Please try again.");
      return;
    }

    toast.success("Welcome to the Suhba! ✨");
    // Force profile refetch by reloading
    window.location.href = "/";
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Community Guidelines & Privacy Policy
          </h1>
        </div>
        {readOnly && (
          <p className="mt-1 text-sm text-muted-foreground">
            Review our community standards at any time.
          </p>
        )}
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Introduction */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <p className="text-sm text-foreground leading-relaxed">
            Bismillah. Welcome to the Suhba — a private spiritual community built on trust,
            respect, and sacred companionship. By joining, you agree to uphold the following
            guidelines that protect every member of our community.
          </p>
        </div>

        {/* Section 1: Adab & Conduct */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              Adab & Code of Conduct
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed list-disc list-inside">
            <li>Treat every member with kindness, dignity, and respect — regardless of background.</li>
            <li>Maintain the sanctity of our gatherings. Arrive on time, participate with presence, and leave with gratitude.</li>
            <li>Disagreements are natural; handle them privately and with good character (husn al-khuluq).</li>
            <li>This is a family-friendly community. Language and behavior must be appropriate for all ages.</li>
            <li>Follow the guidance of community leaders and respect the structure of events.</li>
          </ul>
        </div>

        {/* Section 2: Strict Privacy */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              Strict Privacy Policy
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed list-disc list-inside">
            <li>
              <strong>What happens in the Suhba stays in the Suhba.</strong> Do not share personal stories,
              discussions, or vulnerabilities expressed during gatherings with anyone outside the group.
            </li>
            <li>Member contact information (phone numbers, addresses, etc.) is strictly confidential and must never be shared externally.</li>
            <li>Event locations are private and should not be disclosed to non-members without admin approval.</li>
            <li>Any breach of privacy may result in removal from the community.</li>
          </ul>
        </div>

        {/* Section 3: Zero Social Media Policy */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              Zero Social Media Policy
            </h2>
          </div>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed list-disc list-inside">
            <li>
              <strong>No photos, videos, or audio recordings</strong> of gatherings, members, or conversations
              may be posted on any social media platform — public or private.
            </li>
            <li>Do not "check in" or tag locations of our events on social media.</li>
            <li>Screenshots of this app, member lists, or conversations within the community are not to be shared online.</li>
            <li>If you wish to share a general reflection (without identifying anyone), seek permission from the community admin first.</li>
          </ul>
        </div>

        {/* Section 4: General Terms */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <h2 className="font-heading text-lg font-semibold text-card-foreground">
            General Terms
          </h2>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed list-disc list-inside">
            <li>Admins reserve the right to approve or deny membership at their discretion.</li>
            <li>Repeated violations of these guidelines may result in suspension or removal.</li>
            <li>These guidelines may be updated from time to time. Continued membership implies acceptance of any changes.</li>
            <li>Guest requests are subject to admin approval. You are responsible for the conduct of any guests you invite.</li>
          </ul>
        </div>

        {/* Agreement section — only for non-read-only */}
        {!readOnly && (
          <div className="rounded-lg border-2 border-primary/40 bg-card p-6 space-y-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="agree-terms"
                checked={agreed}
                onCheckedChange={(v) => setAgreed(v === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="agree-terms"
                className="text-sm font-medium text-foreground leading-relaxed cursor-pointer"
              >
                I have read and agree to uphold the Adab and Privacy policies of the Suhba.
              </label>
            </div>

            <Button
              className="w-full h-12 text-base"
              disabled={!agreed || saving}
              onClick={handleAccept}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Accept & Continue
            </Button>
          </div>
        )}

        {readOnly && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => navigate(-1)}
          >
            ← Back
          </Button>
        )}
      </main>
    </div>
  );
}
