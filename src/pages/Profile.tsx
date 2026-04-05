import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, User, CalendarIcon, Loader2, ScrollText } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import DependentsSection from "@/components/profile/DependentsSection";

const COUNTRY_CODES = [
  { code: "+971", label: "🇦🇪 +971", country: "UAE" },
  { code: "+966", label: "🇸🇦 +966", country: "Saudi" },
  { code: "+973", label: "🇧🇭 +973", country: "Bahrain" },
  { code: "+974", label: "🇶🇦 +974", country: "Qatar" },
  { code: "+968", label: "🇴🇲 +968", country: "Oman" },
  { code: "+965", label: "🇰🇼 +965", country: "Kuwait" },
  { code: "+20", label: "🇪🇬 +20", country: "Egypt" },
  { code: "+91", label: "🇮🇳 +91", country: "India" },
  { code: "+92", label: "🇵🇰 +92", country: "Pakistan" },
  { code: "+44", label: "🇬🇧 +44", country: "UK" },
  { code: "+1", label: "🇺🇸 +1", country: "US" },
];

function extractCountryAndNumber(e164: string | null): { countryCode: string; localNumber: string } {
  if (!e164) return { countryCode: "+971", localNumber: "" };
  // Try matching longest country codes first
  const sorted = [...COUNTRY_CODES].sort((a, b) => b.code.length - a.code.length);
  for (const cc of sorted) {
    if (e164.startsWith(cc.code)) {
      return { countryCode: cc.code, localNumber: e164.slice(cc.code.length) };
    }
  }
  return { countryCode: "+971", localNumber: e164.replace(/^\+/, "") };
}

function toE164(countryCode: string, localNumber: string): string {
  // Strip spaces, dashes, parens, leading zeros
  const cleaned = localNumber.replace(/[\s\-()]/g, "").replace(/^0+/, "");
  return `${countryCode}${cleaned}`;
}

function isValidLocalNumber(num: string): boolean {
  const cleaned = num.replace(/[\s\-()]/g, "").replace(/^0+/, "");
  return /^\d{4,15}$/.test(cleaned);
}

export default function ProfilePage() {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();

  const [whatsappCC, setWhatsappCC] = useState("+971");
  const [whatsappNum, setWhatsappNum] = useState("");
  const [altCC, setAltCC] = useState("+971");
  const [altNum, setAltNum] = useState("");
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      const wa = extractCountryAndNumber(profile.whatsapp_number);
      setWhatsappCC(wa.countryCode);
      setWhatsappNum(wa.localNumber);

      const alt = extractCountryAndNumber(profile.alternate_cell_number);
      setAltCC(alt.countryCode);
      setAltNum(alt.localNumber);

      if (profile.date_of_birth) {
        setDob(parse(profile.date_of_birth, "yyyy-MM-dd", new Date()));
      }
    }
  }, [profile]);

  const handleSave = async () => {
    if (!user) return;

    // Validate WhatsApp (required)
    if (!whatsappNum.trim()) {
      toast.error("WhatsApp number is required.");
      return;
    }
    if (!isValidLocalNumber(whatsappNum)) {
      toast.error("Please enter a valid WhatsApp number.");
      return;
    }

    // Validate alt number if provided
    if (altNum.trim() && !isValidLocalNumber(altNum)) {
      toast.error("Please enter a valid alternate cell number.");
      return;
    }

    setSaving(true);
    const updates: Record<string, string | null> = {
      whatsapp_number: toE164(whatsappCC, whatsappNum),
      alternate_cell_number: altNum.trim() ? toE164(altCC, altNum) : null,
      date_of_birth: dob ? format(dob, "yyyy-MM-dd") : null,
    };

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    setSaving(false);

    if (error) {
      toast.error("Failed to update profile.");
    } else {
      toast.success("Profile updated successfully.");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <h1 className="font-heading text-2xl font-bold text-foreground">Profile</h1>
      </header>

      <main className="mx-auto max-w-lg px-4 py-6 space-y-6">
        {/* Info card */}
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

          <div className="text-sm">
            <span className="text-muted-foreground">Status: </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary capitalize">
              {profile?.role}
            </span>
          </div>
        </div>

        {/* Editable form */}
        <div className="rounded-lg border border-border bg-card p-6 space-y-5">
          <h3 className="font-heading text-lg font-semibold text-card-foreground">My Details</h3>

          {/* WhatsApp Number */}
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

          {/* Alternate Cell */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">
              Alternate Cell Number
            </Label>
            <p className="text-xs text-muted-foreground -mt-1">(If different from WhatsApp)</p>
            <div className="flex gap-2">
              <Select value={altCC} onValueChange={setAltCC}>
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
                value={altNum}
                onChange={(e) => setAltNum(e.target.value)}
              />
            </div>
          </div>

          {/* Date of Birth */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Date of Birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !dob && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dob ? format(dob, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dob}
                  onSelect={setDob}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1940}
                  toYear={new Date().getFullYear()}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>

        <DependentsSection />

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate("/guidelines")}
        >
          <ScrollText className="h-4 w-4" />
          Community Guidelines
        </Button>

        <Button
          variant="outline"
          className="w-full"
          onClick={signOut}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </Button>
      </main>
    </div>
  );
}
