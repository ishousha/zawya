import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ScrollText, ShieldCheck, EyeOff, Camera, Home, UserCheck, Lock } from "lucide-react";
import { toast } from "sonner";

interface CommunityGuidelinesProps {
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
      .update({ terms_accepted: true })
      .eq("id", user.id);
    setSaving(false);

    if (error) {
      toast.error("Failed to save agreement. Please try again.");
      return;
    }

    toast.success("Welcome to the Suhba! ✨");
    // Signal AuthContext to refetch profile so routing picks up terms_accepted = true
    window.dispatchEvent(new Event("profile-updated"));
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Zawya Community Guidelines & Code of Adab
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
            Welcome to our Suhba. This app and our gatherings are designed to be a private, safe, and
            spiritually uplifting space for our community and families. By joining, you agree to uphold
            the highest standards of <strong>Adab</strong> (beautiful character) and respect for your fellow members.
          </p>
        </div>

        {/* Section 1: Strict Privacy & Confidentiality */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              1. Strict Privacy & Confidentiality (The Amanah)
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            Our gatherings are a sanctuary. What is said, shared, or experienced within the Suhba is
            considered an <strong>Amanah</strong> (a sacred trust). You may not share personal stories, struggles,
            or discussions of other members with anyone outside of this community.
          </p>
        </div>

        {/* Section 2: Zero Social Media Policy */}
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-2">
            <EyeOff className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              2. Zero Social Media Policy
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            To preserve the spiritual integrity of our gatherings, posting anything about our events, locations,
            or members on social media (Instagram, Facebook, TikTok, X, WhatsApp Statuses, etc.) is <strong>strictly prohibited</strong>.
          </p>
        </div>

        {/* Section 3: Photography & Recording */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              3. Photography & Recording
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            We ask that you remain present during gatherings and keep phones put away. If you take a photo
            of your own family or friends for a personal memory, it must remain strictly for your
            <strong> private, personal use</strong>. You may not forward, broadcast, or post any photos or
            audio/video recordings that include other members, their children, or the venue, even in private
            chats outside the Suhba.
          </p>
        </div>

        {/* Section 4: Respecting Our Hosts */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Home className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              4. Respecting Our Hosts
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            Many of our gatherings take place in the private homes of our members. Please treat their homes
            with the utmost respect, mind your parking so as not to disturb neighbors, and supervise your
            children at all times.
          </p>
        </div>

        {/* Section 5: Vetted Membership */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-3">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-lg font-semibold text-card-foreground">
              5. Vetted Membership
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed">
            This app is for <strong>approved members only</strong>. Please do not share your login credentials,
            Magic Links, or event details with non-members. Any guests must be officially requested and
            approved via the app prior to attending.
          </p>
        </div>

        {/* App Privacy Policy */}
        <div className="rounded-lg border-2 border-primary/20 bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary shrink-0" />
            <h2 className="font-heading text-xl font-semibold text-card-foreground">
              App Privacy Policy
            </h2>
          </div>
          <p className="text-sm text-foreground leading-relaxed font-medium">
            How We Protect Your Data: As a private community, we take your digital privacy just as
            seriously as your physical privacy.
          </p>
          <ul className="space-y-2 text-sm text-foreground leading-relaxed list-disc list-inside">
            <li>
              <strong>What we collect:</strong> We collect only what is necessary to run the Suhba smoothly:
              your name, WhatsApp number, email, and the names/ages of your dependents.
            </li>
            <li>
              <strong>How we use it:</strong> Your data is used exclusively for event RSVP management,
              capacity planning, and direct administrative communication (like event reminders or cancellation notices).
            </li>
            <li>
              <strong>No Third-Party Sharing:</strong> Your data will never be sold, shared, or used for
              marketing by any outside party. It is stored securely on encrypted servers.
            </li>
            <li>
              <strong>Admin Access:</strong> Only designated community admins have access to your contact information.
            </li>
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
