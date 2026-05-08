import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { PlusCircle, ClipboardList, UserPlus, Video, X, ExternalLink, ScanLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

function QuickActionCard({
  icon: Icon,
  label,
  badge,
  onClick,
  live,
}: {
  icon: React.ElementType;
  label: string;
  badge?: number;
  onClick: () => void;
  live?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${
        live
          ? "bg-primary/10 border-2 border-primary hover:bg-primary/15"
          : "bg-card border border-border hover:bg-accent"
      }`}
    >
      {live && (
        <span className="absolute top-2 right-2 flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
        </span>
      )}
      {badge != null && badge > 0 && (
        <span className="absolute top-2 right-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
          {badge}
        </span>
      )}
      <Icon className="h-6 w-6 text-primary" />
      <span className="text-sm font-medium text-center text-foreground">{label}</span>
    </button>
  );
}

export default function AdminQuickActions() {
  const navigate = useNavigate();
  const [recordingModalOpen, setRecordingModalOpen] = useState(false);

  const { data: pendingCount } = useQuery({
    queryKey: ["pending-users-count"],
    staleTime: 60_000,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("role", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: nextEvent } = useQuery({
    queryKey: ["admin-next-event"],
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date();
      const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000).toISOString();
      // Pull recent + upcoming candidates; pick live first, else soonest upcoming
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, end_date_time")
        .in("status", ["active", "full"])
        .eq("published", true)
        .gte("date_time", sixHoursAgo)
        .order("date_time", { ascending: true })
        .limit(10);
      if (error) throw error;
      if (!data?.length) return null;

      const nowMs = now.getTime();
      // Live: started in past, effective end still in future (end_date_time, or +6h fallback)
      const live = data.find((e) => {
        const start = new Date(e.date_time).getTime();
        const end = e.end_date_time
          ? new Date(e.end_date_time).getTime()
          : start + 6 * 60 * 60 * 1000;
        return start <= nowMs && end >= nowMs;
      });
      if (live) return live;
      // Else soonest future event
      return data.find((e) => new Date(e.date_time).getTime() > nowMs) ?? null;
    },
  });

  const handleNextEventGuestList = () => {
    if (nextEvent) {
      navigate("/admin", { state: { tab: "events", eventId: nextEvent.id } });
    } else {
      toast.info("No upcoming events found.");
    }
  };

  return (
    <>
      <div className="mb-6">
        <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full">
          <QuickActionCard
            icon={PlusCircle}
            label="Create Event"
            onClick={() => navigate("/admin", { state: { tab: "events", action: "create" } })}
          />
          <QuickActionCard
            icon={ClipboardList}
            label="Next Event Guest List"
            onClick={handleNextEventGuestList}
          />
          <QuickActionCard
            icon={UserPlus}
            label="Pending Approvals"
            badge={pendingCount ?? 0}
            onClick={() => navigate("/admin", { state: { tab: "users" } })}
          />
          <QuickActionCard
            icon={Video}
            label="Add Recording"
            onClick={() => setRecordingModalOpen(true)}
          />
        </div>
      </div>

      {recordingModalOpen && (
        <AddRecordingModal onClose={() => setRecordingModalOpen(false)} />
      )}
    </>
  );
}

function AddRecordingModal({ onClose }: { onClose: () => void }) {
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [recordingUrl, setRecordingUrl] = useState("");
  const [recordingPasscode, setRecordingPasscode] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: pastEvents, isLoading } = useQuery({
    queryKey: ["admin-past-events-for-recording"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, recording_url")
        .in("status", ["active", "full"])
        .lt("date_time", now)
        .order("date_time", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as (Event & { recording_url: string | null })[];
    },
  });

  const handleSave = async () => {
    if (!selectedEventId || !recordingUrl.trim()) return;
    setSaving(true);
    const { error } = await supabase
      .from("events")
      .update({
        recording_url: recordingUrl.trim(),
        recording_passcode: recordingPasscode.trim() || null,
      } as any)
      .eq("id", selectedEventId);
    setSaving(false);
    if (error) {
      toast.error("Failed to save recording.");
    } else {
      toast.success("Recording added successfully!");
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-heading text-lg font-semibold text-foreground">Add Recording</h3>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Loading past events…</p>
        ) : !pastEvents?.length ? (
          <p className="text-sm text-muted-foreground py-4 text-center">No past events found.</p>
        ) : (
          <div className="space-y-4">
            <div>
              <Label className="mb-1.5 block">Select Event</Label>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
                {pastEvents.map((ev) => (
                  <button
                    key={ev.id}
                    onClick={() => setSelectedEventId(ev.id)}
                    className={`w-full text-left rounded-lg px-3 py-2 text-sm transition-colors ${
                      selectedEventId === ev.id
                        ? "bg-primary/10 text-primary font-medium"
                        : "hover:bg-muted text-foreground"
                    }`}
                  >
                    <span className="block truncate">{ev.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(ev.date_time).toLocaleDateString()}
                      {ev.recording_url && " • ✅ Has recording"}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {selectedEventId && (
              <>
                <div>
                  <Label htmlFor="rec-url">Recording URL</Label>
                  <Input
                    id="rec-url"
                    type="url"
                    value={recordingUrl}
                    onChange={(e) => setRecordingUrl(e.target.value)}
                    placeholder="https://zoom.us/rec/share/..."
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label htmlFor="rec-pass">Passcode (optional)</Label>
                  <Input
                    id="rec-pass"
                    type="text"
                    value={recordingPasscode}
                    onChange={(e) => setRecordingPasscode(e.target.value)}
                    placeholder="Optional passcode"
                    className="mt-1.5"
                  />
                </div>
                <Button
                  onClick={handleSave}
                  disabled={saving || !recordingUrl.trim()}
                  className="w-full"
                >
                  {saving ? "Saving…" : "Save Recording"}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
