import { useAuth } from "@/contexts/AuthContext";
import { ClearInstallDismissButton } from "@/components/InstallAppBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CountryCodeCombobox } from "@/components/CountryCodeCombobox";
import { extractCountryAndNumber } from "@/lib/country-codes";
import { LogOut, User, CalendarIcon, Loader2, ScrollText, Camera, Download, Share, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import DependentsSection from "@/components/profile/DependentsSection";
import ChangeEmailSection from "@/components/profile/ChangeEmailSection";
import { GenderToggle } from "@/pages/CompleteProfile";
import FamilyInviteSection from "@/components/profile/FamilyInviteSection";
import LinkedAccounts from "@/components/profile/LinkedAccounts";
import NotificationPreferences from "@/components/profile/NotificationPreferences";
import UserAvatar from "@/components/UserAvatar";
import { forceRefreshApp } from "@/components/PWAUpdatePrompt";
import { useAppVersion } from "@/hooks/useAppVersion";


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
  const queryClient = useQueryClient();
  const appVersion = useAppVersion();

  const [gender, setGender] = useState("");
  const [whatsappCC, setWhatsappCC] = useState("+971");
  const [whatsappNum, setWhatsappNum] = useState("");
  const [altCC, setAltCC] = useState("+971");
  const [altNum, setAltNum] = useState("");
  const [dob, setDob] = useState<Date | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const isStandalone =
    typeof window !== "undefined" &&
    (window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true);

  const isIOSSafari = (() => {
    if (typeof navigator === "undefined") return false;
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|OPiOS|EdgiOS/.test(ua);
    return isIOS && isSafari;
  })();

  useEffect(() => {
    if (isStandalone) return;
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [isStandalone]);

  const handleInstallApp = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setInstallPrompt(null);
  };

  // Populate form when profile loads
  useEffect(() => {
    if (profile) {
      setGender((profile as any).gender || "");

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
      gender: gender || null,
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
      // Force AuthContext to refetch profile and clear any stale dashboard
      // queries so the home view doesn't briefly show zeros after a save.
      window.dispatchEvent(new Event("profile-updated"));
      await queryClient.invalidateQueries();
      navigate("/");
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB.");
      return;
    }

    setUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      // Add cache-buster to force refresh
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: avatarUrl })
        .eq("id", user.id);
      if (updateError) throw updateError;

      // Refresh profile in context
      const { data: refreshed } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();
      if (refreshed) {
        // Force re-render by triggering auth context refresh
        window.dispatchEvent(new Event("profile-updated"));
      }

      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload image.");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
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
            <div className="relative group">
              <UserAvatar
                name={profile?.name}
                avatarUrl={(profile as any)?.avatar_url}
                className="h-16 w-16 text-lg"
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
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
              <CountryCodeCombobox value={whatsappCC} onChange={setWhatsappCC} />
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
              <CountryCodeCombobox value={altCC} onChange={setAltCC} />
              <Input
                type="tel"
                placeholder="501234567"
                value={altNum}
                onChange={(e) => setAltNum(e.target.value)}
              />
            </div>
          </div>

          {/* Gender */}
          <div className="space-y-2">
            <Label className="text-sm font-medium text-foreground">Gender</Label>
            <GenderToggle value={gender} onChange={setGender} />
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

        <ChangeEmailSection currentEmail={user?.email} />

        <FamilyInviteSection />

        <DependentsSection />

        <LinkedAccounts />

        <NotificationPreferences />

        {!isStandalone && (installPrompt || isIOSSafari) && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <Download className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="font-heading text-sm font-semibold text-card-foreground">Install Zawya</p>
                <p className="text-xs text-muted-foreground">
                  {isIOSSafari
                    ? "Add to your home screen for quick access"
                    : "Get the full app experience"}
                </p>
              </div>
            </div>
            {installPrompt ? (
              <Button className="w-full gap-2" onClick={handleInstallApp}>
                <Download className="h-4 w-4" />
                Install App
              </Button>
            ) : (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 p-3">
                <Share className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Tap{" "}
                  <span className="inline-flex items-center gap-0.5 font-semibold text-foreground">
                    <Share className="inline h-3.5 w-3.5" /> Share
                  </span>{" "}
                  then select{" "}
                  <span className="font-semibold text-foreground">Add to Home Screen</span>.
                </p>
              </div>
            )}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={() => navigate("/guidelines")}
        >
          <ScrollText className="h-4 w-4" />
          Community Guidelines
        </Button>

        {(() => {
          const fmt = (iso: string | null | undefined) => {
            if (!iso) return "";
            try {
              return new Date(iso).toLocaleString(undefined, {
                year: "2-digit",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              });
            } catch {
              return iso;
            }
          };
          const { status, localBuildTime, serverBuildTime } = appVersion;
          const isChecking = status === "checking";
          const isUpdate = status === "update-available";
          const isCurrent = status === "up-to-date";

          const statusLine = isChecking
            ? "Checking for updates…"
            : isUpdate
            ? `Update available · New build ${fmt(serverBuildTime)}`
            : isCurrent
            ? `You're up to date · Build ${fmt(localBuildTime)}`
            : `Build ${fmt(localBuildTime)}`;

          const StatusIcon = isUpdate
            ? AlertCircle
            : isCurrent
            ? CheckCircle2
            : RefreshCw;

          const statusColor = isUpdate
            ? "text-amber-600"
            : isCurrent
            ? "text-emerald-600"
            : "text-muted-foreground";

          const handleClick = async () => {
            if (isUpdate) {
              toast.info("Updating to latest version…");
              forceRefreshApp();
              return;
            }
            const next = await appVersion.recheck();
            if (next === "update-available") {
              toast.info("Updating to latest version…");
              forceRefreshApp();
            } else if (next === "up-to-date") {
              toast.success("You're on the latest version");
            } else {
              toast.message("Couldn't check — refreshing anyway");
              forceRefreshApp();
            }
          };

          return (
            <div className="space-y-2">
              <div className={cn("flex items-center gap-2 text-xs", statusColor)}>
                <StatusIcon
                  className={cn("h-3.5 w-3.5 shrink-0", isChecking && "animate-spin")}
                />
                <span>{statusLine}</span>
              </div>
              <Button
                variant={isUpdate ? "default" : "outline"}
                className="w-full gap-2"
                onClick={handleClick}
                disabled={isChecking}
              >
                <RefreshCw className={cn("h-4 w-4", isChecking && "animate-spin")} />
                {isChecking ? "Checking…" : isUpdate ? "Update App" : "Check for updates"}
              </Button>
            </div>
          );
        })()}

        {profile?.role === "admin" && (
          <div className="rounded-lg border border-border bg-card p-4 space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Admin Tools</p>
            <ClearInstallDismissButton />
          </div>
        )}

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
