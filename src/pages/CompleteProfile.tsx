import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COUNTRY_CODES = [
  { code: "+971", label: "🇦🇪 +971" },
  { code: "+966", label: "🇸🇦 +966" },
  { code: "+973", label: "🇧🇭 +973" },
  { code: "+974", label: "🇶🇦 +974" },
  { code: "+968", label: "🇴🇲 +968" },
  { code: "+965", label: "🇰🇼 +965" },
  { code: "+20", label: "🇪🇬 +20" },
  { code: "+91", label: "🇮🇳 +91" },
  { code: "+92", label: "🇵🇰 +92" },
  { code: "+44", label: "🇬🇧 +44" },
  { code: "+1", label: "🇺🇸 +1" },
];

function toE164(countryCode: string, localNumber: string): string {
  const cleaned = localNumber.replace(/[\s\-()]/g, "").replace(/^0+/, "");
  return `${countryCode}${cleaned}`;
}

function isValidLocalNumber(num: string): boolean {
  const cleaned = num.replace(/[\s\-()]/g, "").replace(/^0+/, "");
  return /^\d{4,15}$/.test(cleaned);
}

function GenderToggle({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {[
        { val: "male", label: "Male", icon: "♂" },
        { val: "female", label: "Female", icon: "♀" },
      ].map((opt) => (
        <button
          key={opt.val}
          type="button"
          onClick={() => onChange(opt.val)}
          className={cn(
            "flex items-center justify-center gap-2 rounded-lg border-2 py-3 text-sm font-medium transition-all",
            "min-h-[44px]",
            value === opt.val
              ? "border-primary bg-primary/10 text-primary"
              : "border-border bg-card text-muted-foreground hover:border-primary/40"
          )}
        >
          <span className="text-lg">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { GenderToggle };

export default function CompleteProfile() {
  const { user, signOut } = useAuth();
  const [name, setName] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [gender, setGender] = useState("");
  const [whatsappCC, setWhatsappCC] = useState("+971");
  const [whatsappNum, setWhatsappNum] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!user) return;

    if (!name.trim()) {
      toast.error("Please enter your full name.");
      return;
    }
    if (!gender) {
      toast.error("Please select your gender.");
      return;
    }
    if (!whatsappNum.trim() || !isValidLocalNumber(whatsappNum)) {
      toast.error("Please enter a valid WhatsApp number.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        name: name.trim(),
        family_name: familyName.trim() || null,
        gender,
        whatsapp_number: toE164(whatsappCC, whatsappNum),
      } as any)
      .eq("id", user.id);

    if (error) {
      toast.error("Failed to save profile.");
      setSaving(false);
      return;
    }

    // Notify all admins about the new pending member
    try {
      const { data: admins } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "admin");

      if (admins && admins.length > 0) {
        const adminIds = admins.map((a) => a.user_id);
        const { data: adminProfiles } = await supabase
          .from("profiles")
          .select("id, email")
          .in("id", adminIds);

        const memberEmail = user?.email || "";
        const fullPhone = whatsappNum ? toE164(whatsappCC, whatsappNum) : "";

        for (const admin of adminProfiles ?? []) {
          if (!admin.email) continue;
          supabase.functions.invoke("send-transactional-email", {
            body: {
              templateName: "new-member-pending",
              recipientEmail: admin.email,
              idempotencyKey: `new-member-pending-${user?.id}-${admin.id}`,
              templateData: {
                memberName: name.trim(),
                memberEmail,
                memberPhone: fullPhone,
              },
            },
          }).catch((err) => console.warn("Failed to notify admin:", err));
        }
      }
    } catch (err) {
      console.warn("Failed to send admin notifications:", err);
    }

    toast.success("Profile saved! Awaiting admin approval.");
    window.location.reload();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm animate-fade-in space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <span className="font-heading text-2xl">🌿</span>
          </div>
          <h1 className="font-heading text-2xl font-bold text-foreground">
            Welcome to Zawya!
          </h1>
          <p className="mt-2 text-muted-foreground">
            Please introduce yourself to the admins.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Full Name <span className="text-destructive">*</span>
            </Label>
            <Input
              placeholder="e.g. Ahmed Hassan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Family Name <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              placeholder="e.g. Hassan"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Gender <span className="text-destructive">*</span>
            </Label>
            <GenderToggle value={gender} onChange={setGender} />
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              WhatsApp Number <span className="text-destructive">*</span>
            </Label>
            <div className="flex gap-2">
              <Select value={whatsappCC} onValueChange={setWhatsappCC}>
                <SelectTrigger className="w-[120px] shrink-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRY_CODES.map((cc) => (
                    <SelectItem key={cc.code} value={cc.code}>
                      {cc.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                type="tel"
                placeholder="501234567"
                value={whatsappNum}
                onChange={(e) => setWhatsappNum(e.target.value)}
              />
            </div>
          </div>

          <Button className="w-full" onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit & Continue
          </Button>
        </div>

        <button
          onClick={signOut}
          className="mx-auto block text-sm text-primary underline underline-offset-2 hover:text-emerald-light"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
