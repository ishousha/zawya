import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Users, User, Loader2, Plus, ArrowRight, ArrowLeft,
  Copy, MessageCircle, Trash2, Baby, UserRound, SkipForward,
  Heart, Sparkles, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type Step = "choose" | "family-name" | "invite-add";

interface PendingDependent {
  firstName: string;
  type: "child" | "elder";
}

/** Decorative geometric pattern background */
function OnboardingPattern() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-[0.04]">
      <svg className="absolute -top-20 -right-20 h-80 w-80 text-primary" viewBox="0 0 200 200">
        <defs>
          <pattern id="onb-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <circle cx="10" cy="10" r="1.5" fill="currentColor" />
          </pattern>
        </defs>
        <rect width="200" height="200" fill="url(#onb-grid)" />
      </svg>
      <svg className="absolute -bottom-16 -left-16 h-64 w-64 text-primary" viewBox="0 0 200 200">
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeWidth="0.5" />
        <circle cx="100" cy="100" r="40" fill="none" stroke="currentColor" strokeWidth="0.5" />
      </svg>
    </div>
  );
}

/** Step indicator dots */
function StepIndicator({ current }: { current: Step }) {
  const steps: Step[] = ["choose", "family-name", "invite-add"];
  const labels = ["Choose", "Name", "Setup"];
  const currentIdx = steps.indexOf(current);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                i < currentIdx
                  ? "border-primary bg-primary text-primary-foreground"
                  : i === currentIdx
                  ? "border-primary bg-primary/10 text-primary scale-110"
                  : "border-muted-foreground/30 bg-muted/50 text-muted-foreground"
              }`}
            >
              {i < currentIdx ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <span className="text-xs font-semibold">{i + 1}</span>
              )}
            </div>
            <span className={`text-[10px] font-medium ${
              i <= currentIdx ? "text-primary" : "text-muted-foreground"
            }`}>
              {labels[i]}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`h-0.5 w-8 mb-4 rounded-full transition-colors duration-500 ${
                i < currentIdx ? "bg-primary" : "bg-muted-foreground/20"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

export default function Onboarding() {
  const { user, profile, signOut } = useAuth();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("choose");
  const [familyName, setFamilyName] = useState("");
  const [saving, setSaving] = useState(false);
  const [createdFamilyId, setCreatedFamilyId] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  // Invite state
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Dependent state
  const [dependents, setDependents] = useState<PendingDependent[]>([]);
  const [depName, setDepName] = useState("");
  const [depType, setDepType] = useState<"child" | "elder">("child");
  const [showDepForm, setShowDepForm] = useState(false);

  const progress = step === "choose" ? 33 : step === "family-name" ? 66 : 100;

  const goToStep = (next: Step) => {
    setAnimating(true);
    setTimeout(() => {
      setStep(next);
      setAnimating(false);
    }, 200);
  };

  // --- Step 1: Continue as individual ---
  const handleIndividual = async () => {
    setSaving(true);
    const name = profile?.name || "My";
    const label = `${name.split(/\s+/).pop() || "My"} Family`;

    const { data: fam, error: fErr } = await supabase
      .from("families")
      .insert({ name: label })
      .select("id")
      .single();

    if (fErr || !fam) {
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    const { error: lErr } = await supabase
      .from("profiles")
      .update({ family_id: fam.id })
      .eq("id", user!.id);

    if (lErr) {
      await supabase.from("families").delete().eq("id", fam.id);
      toast.error("Something went wrong. Please try again.");
      setSaving(false);
      return;
    }

    toast.success("You're all set!");
    window.dispatchEvent(new Event("profile-updated"));
    setSaving(false);
    window.location.replace("/");
  };

  // --- Step 2: Create family ---
  const handleCreateFamily = async () => {
    if (!familyName.trim()) {
      toast.error("Please enter a family name.");
      return;
    }
    setSaving(true);

    const { data: fam, error: fErr } = await supabase
      .from("families")
      .insert({ name: familyName.trim() })
      .select("id")
      .single();

    if (fErr || !fam) {
      toast.error("Failed to create family group.");
      setSaving(false);
      return;
    }

    const { error: lErr } = await supabase
      .from("profiles")
      .update({ family_id: fam.id })
      .eq("id", user!.id);

    if (lErr) {
      await supabase.from("families").delete().eq("id", fam.id);
      toast.error("Failed to link family.");
      setSaving(false);
      return;
    }

    setCreatedFamilyId(fam.id);
    window.dispatchEvent(new Event("profile-updated"));
    setSaving(false);
    goToStep("invite-add");
  };

  // --- Step 3 helpers ---
  const handleCreateInvite = async () => {
    if (!createdFamilyId || !user) return;
    setCreatingInvite(true);
    const { data, error } = await supabase
      .from("family_invites")
      .insert({ family_id: createdFamilyId, created_by: user.id })
      .select("token")
      .single();
    setCreatingInvite(false);
    if (error || !data) {
      toast.error("Failed to create invite link.");
      return;
    }
    const url = `${window.location.origin}/join-family?token=${data.token}`;
    setInviteLink(url);
    navigator.clipboard.writeText(url).then(() => toast.success("Invite link copied!")).catch(() => {});
  };

  const shareViaWhatsApp = () => {
    if (!inviteLink) return;
    const text = encodeURIComponent(
      `You're invited to join our family on Zawya! Tap the link to accept:\n${inviteLink}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  const addDependent = () => {
    if (!depName.trim()) return;
    setDependents((prev) => [...prev, { firstName: depName.trim(), type: depType }]);
    setDepName("");
    setDepType("child");
    setShowDepForm(false);
    toast.success("Dependent added.");
  };

  const removeDependent = (idx: number) => {
    setDependents((prev) => prev.filter((_, i) => i !== idx));
  };

  // --- Finish ---
  const handleFinish = async () => {
    setSaving(true);
    if (dependents.length > 0 && createdFamilyId) {
      const rows = dependents.map((d) => ({
        parent_id: user!.id,
        family_id: createdFamilyId,
        first_name: d.firstName,
        type: d.type,
      }));
      await supabase.from("dependents").insert(rows as any);
    }
    queryClient.invalidateQueries({ queryKey: ["dependents"] });
    queryClient.invalidateQueries({ queryKey: ["family-members"] });
    toast.success("Welcome to Zawya!");
    setSaving(false);
    window.location.replace("/");
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <OnboardingPattern />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Header with animated icon */}
        <div className="text-center animate-fade-in">
          <div className="mx-auto mb-4 relative">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 shadow-lg shadow-primary/10">
              <span className="text-4xl" role="img" aria-label="plant">🌿</span>
            </div>
            <div className="absolute -top-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-accent">
              <Sparkles className="h-3.5 w-3.5 text-accent-foreground" />
            </div>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Welcome to Zawya
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {step === "choose" && "Let's set up your family profile"}
            {step === "family-name" && "Give your family group a name"}
            {step === "invite-add" && "Almost done! Add your family members"}
          </p>
        </div>

        {/* Step indicator */}
        <StepIndicator current={step} />

        {/* Progress bar */}
        <Progress value={progress} className="h-1.5 transition-all duration-500" />

        {/* Step content with fade transition */}
        <div
          className={`transition-all duration-200 ${
            animating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
          }`}
        >
          {/* Step 1: Choose */}
          {step === "choose" && (
            <div className="space-y-4 animate-fade-in">
              <p className="text-center text-sm text-muted-foreground">
                How would you like to use Zawya?
              </p>
              <div className="grid gap-3">
                <Card
                  className="group cursor-pointer border-2 hover:border-primary hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                  onClick={() => goToStep("family-name")}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10 transition-colors">
                      <Users className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-foreground flex items-center gap-1.5">
                        Create a Family Group
                        <Heart className="h-3.5 w-3.5 text-primary/60" />
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Manage RSVPs together with your spouse and dependents
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                  </CardContent>
                </Card>

                <Card
                  className="group cursor-pointer border-2 hover:border-primary hover:shadow-md hover:shadow-primary/5 transition-all duration-200"
                  onClick={handleIndividual}
                >
                  <CardContent className="flex items-center gap-4 p-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent/80 group-hover:bg-accent transition-colors">
                      <User className="h-7 w-7 text-accent-foreground" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading font-semibold text-foreground">Continue as Individual</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You can always create a family later
                      </p>
                    </div>
                    {saving ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground shrink-0" />
                    ) : (
                      <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* Step 2: Family name */}
          {step === "family-name" && (
            <div className="space-y-5 animate-fade-in">
              <div className="rounded-xl border border-border bg-card p-6 space-y-4 shadow-sm">
                {/* Decorative family icon */}
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5">
                    <Users className="h-8 w-8 text-primary" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Family Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. The Abushousha Family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                    className="text-center text-base"
                    autoFocus
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    This name will be visible to other community members.
                  </p>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => goToStep("choose")}
                    className="gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    className="flex-1 gap-1.5"
                    onClick={handleCreateFamily}
                    disabled={saving || !familyName.trim()}
                  >
                    {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                    Create Family
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Invite & Add dependents */}
          {step === "invite-add" && (
            <div className="space-y-4 animate-fade-in">
              {/* Success banner */}
              <div className="flex items-center gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3">
                <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                <p className="text-sm text-foreground font-medium">
                  Family group created! Now add your members.
                </p>
              </div>

              {/* Invite spouse */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                <h3 className="font-heading text-base font-semibold text-card-foreground flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  Invite Spouse / Family Member
                </h3>
                <p className="text-xs text-muted-foreground">
                  Share a link so they can join your family group on Zawya.
                </p>
                {!inviteLink ? (
                  <Button
                    size="sm"
                    className="w-full gap-1.5"
                    onClick={handleCreateInvite}
                    disabled={creatingInvite}
                  >
                    {creatingInvite ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    Generate Invite Link
                  </Button>
                ) : (
                  <div className="space-y-2 animate-fade-in">
                    <p className="text-xs text-muted-foreground font-mono truncate rounded-lg bg-muted p-2.5">
                      {inviteLink}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(inviteLink);
                          toast.success("Link copied!");
                        }}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={shareViaWhatsApp}
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Add dependents */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-3 shadow-sm">
                <h3 className="font-heading text-base font-semibold text-card-foreground flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <Baby className="h-4 w-4 text-primary" />
                  </div>
                  Add Dependents
                </h3>
                <p className="text-xs text-muted-foreground">
                  Add children or elderly family members who can't use the app themselves.
                </p>

                {dependents.length > 0 && (
                  <div className="space-y-1.5">
                    {dependents.map((dep, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-lg border border-border p-2.5 animate-fade-in">
                        <div className="flex items-center gap-2">
                          {dep.type === "elder" ? (
                            <UserRound className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <Baby className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium text-card-foreground">{dep.firstName}</span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {dep.type === "elder" ? "Elder/Adult" : "Child"}
                          </Badge>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          onClick={() => removeDependent(idx)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {showDepForm ? (
                  <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 animate-fade-in">
                    <Select value={depType} onValueChange={(v) => setDepType(v as "child" | "elder")}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="child">Child</SelectItem>
                        <SelectItem value="elder">Elder/Adult</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input
                      placeholder="First name"
                      value={depName}
                      onChange={(e) => setDepName(e.target.value)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addDependent} disabled={!depName.trim()}>
                        Save
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setShowDepForm(false); setDepName(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5"
                    onClick={() => setShowDepForm(true)}
                  >
                    <Plus className="h-4 w-4" /> Add Dependent
                  </Button>
                )}
              </div>

              {/* Finish */}
              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  className="gap-1.5"
                  onClick={handleFinish}
                  disabled={saving}
                >
                  <SkipForward className="h-4 w-4" />
                  Skip for now
                </Button>
                <Button
                  className="flex-1 gap-1.5"
                  onClick={handleFinish}
                  disabled={saving}
                >
                  {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Finish Setup
                  <Sparkles className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={signOut}
          className="mx-auto block text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
