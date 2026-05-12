import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Bell, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Preferences {
  events: boolean;
  rsvp: boolean;
  guest: boolean;
  family: boolean;
  info: boolean;
}

const PREF_OPTIONS: { key: keyof Preferences; label: string; description: string }[] = [
  { key: "events", label: "Events", description: "Event updates, cancellations, and new event announcements" },
  { key: "rsvp", label: "RSVPs", description: "RSVP confirmations and waitlist updates" },
  { key: "guest", label: "Guest Requests", description: "Guest request approvals and rejections" },
  { key: "family", label: "Family", description: "Family member joins and leaves" },
  { key: "info", label: "General", description: "Account approvals and system announcements" },
];

const DEFAULT_PREFS: Preferences = { events: true, rsvp: true, guest: true, family: true, info: true };

export default function NotificationPreferences() {
  const { user, profile } = useAuth();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      const stored = (profile as any).notification_preferences;
      if (stored && typeof stored === "object") {
        setPrefs({ ...DEFAULT_PREFS, ...stored });
      }
    }
  }, [profile]);

  const toggle = async (key: keyof Preferences) => {
    if (!user) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(key);

    const { error } = await supabase
      .from("profiles")
      .update({ notification_preferences: updated } as any)
      .eq("id", user.id);

    setSaving(null);
    if (error) {
      setPrefs(prefs); // revert
      toast.error("Failed to update preference.");
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4 text-primary" />
          Notification Preferences
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-xs text-muted-foreground mb-3">
          Choose which notifications you'd like to receive.
        </p>
        {PREF_OPTIONS.map(({ key, label, description }) => (
          <div
            key={key}
            className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
          >
            <div className="min-w-0 flex-1">
              <Label className="text-sm font-medium cursor-pointer" htmlFor={`notif-${key}`}>
                {label}
              </Label>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                {description}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {saving === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              <Switch
                id={`notif-${key}`}
                checked={prefs[key]}
                onCheckedChange={() => toggle(key)}
                disabled={saving !== null}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
