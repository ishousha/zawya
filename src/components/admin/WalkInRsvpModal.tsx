import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { generateQRHash } from "@/lib/qr-hash";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { AlertTriangle, Check, Loader2, UserPlus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useEventRsvpCounts } from "@/hooks/useRSVP";
import { toast } from "sonner";
import { capacityToastFromError } from "@/lib/rsvp-errors";
import { useEffect } from "react";

interface WalkInRsvpModalProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called with the projected extra attending seats while this modal is open. */
  onProjectionChange?: (extraAttending: number | null) => void;
}

type AddMode = "walkin" | "rsvp" | "waitlist";

export default function WalkInRsvpModal({ eventId, open, onOpenChange, onProjectionChange }: WalkInRsvpModalProps) {
  const queryClient = useQueryClient();

  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);
  const [mode, setMode] = useState<AddMode>("walkin");

  const { data: approvedUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ["approved-users-for-walkin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, family_name")
        .in("role", ["approved", "admin", "moderator", "guest"])
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Filter out users who already have an RSVP for this event
  const { data: existingRsvpUserIds } = useQuery({
    queryKey: ["existing-rsvp-users", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("user_id")
        .eq("event_id", eventId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    },
    enabled: open,
  });

  const { data: eventRow } = useQuery({
    queryKey: ["event-capacity", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("capacity")
        .eq("id", eventId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const { data: rsvpCounts } = useEventRsvpCounts(eventId);
  const capacity = eventRow?.capacity ?? null;
  const attendingCount = rsvpCounts?.attending_count ?? 0;
  const isAtCapacity = !!capacity && attendingCount >= capacity;

  const availableUsers = useMemo(() => {
    if (!approvedUsers) return [];
    if (!existingRsvpUserIds) return approvedUsers;
    return approvedUsers.filter((u) => !existingRsvpUserIds.has(u.id));
  }, [approvedUsers, existingRsvpUserIds]);

  const selectedUser = approvedUsers?.find((u) => u.id === selectedUserId);

  const walkInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("No user selected");

      const rsvpId = crypto.randomUUID();
      const qrHash = await generateQRHash(rsvpId);
      const totalGuests = adultsCount + childrenCount;
      const isWaitlist = mode === "waitlist";
      const autoCheckin = mode === "walkin";

      const { error } = await supabase.from("rsvps").insert({
        id: rsvpId,
        event_id: eventId,
        user_id: selectedUserId,
        guests_count: totalGuests,
        checked_in: autoCheckin,
        qr_hash: qrHash,
        status: isWaitlist ? ("waitlisted" as any) : ("attending" as any),
        is_waitlisted: isWaitlist,
        attending_dependents: childrenCount > 0
          ? Array.from({ length: childrenCount }, (_, i) => ({
              name: `Child ${i + 1}`,
              type: "dependent",
              age_group: "child_4_12",
              age: null,
            }))
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      const label = mode === "walkin" ? "Walk-in" : mode === "waitlist" ? "Waitlist entry" : "RSVP";
      toast.success(`${label} created for ${selectedUser?.name || "user"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["existing-rsvp-users", eventId] });
      queryClient.invalidateQueries({ queryKey: ["event-rsvp-counts", eventId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      const cap = capacityToastFromError(err);
      if (cap) {
        toast.error(cap.title, { description: cap.description });
        return;
      }
      const msg = (err as Error).message;
      if (msg.includes("RSVP_DUPLICATE_COVERED") || msg.includes("RSVP_DUPLICATE_MEMBER")) {
        toast.error("Family conflict", { description: msg.replace(/^.*?:\s*/, "") });
      } else {
        toast.error("Failed to add RSVP: " + msg);
      }
    },
  });

  const resetForm = () => {
    setSelectedUserId(null);
    setAdultsCount(1);
    setChildrenCount(0);
    setMode("walkin");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Attendee
          </DialogTitle>
        </DialogHeader>

        <div className="flex rounded-md border border-border p-0.5 mt-2 text-xs">
          {([
            { v: "walkin", label: "Walk-In" },
            { v: "rsvp", label: "RSVP" },
            { v: "waitlist", label: "Waitlist" },
          ] as { v: AddMode; label: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setMode(opt.v)}
              className={cn(
                "flex-1 h-8 rounded-sm font-medium transition-colors",
                mode === opt.v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>


        <div className="space-y-4 pt-2">
          {/* User search — inline cmdk list (no Popover, avoids Dialog focus-trap conflicts on mobile) */}
          <div className="space-y-2">
            <Label>Select Member</Label>
            {selectedUser ? (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{selectedUser.name || selectedUser.email}</p>
                  {selectedUser.family_name && (
                    <p className="text-xs text-muted-foreground truncate">{selectedUser.family_name}</p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-1 text-xs"
                  onClick={() => setSelectedUserId(null)}
                >
                  <X className="h-3.5 w-3.5" /> Change
                </Button>
              </div>
            ) : (
              <Command className="rounded-md border border-border" shouldFilter={true}>
                <CommandInput placeholder="Search by name..." autoFocus />
                <CommandList className="max-h-64">
                  <CommandEmpty>
                    {loadingUsers ? "Loading..." : "No members found."}
                  </CommandEmpty>
                  <CommandGroup>
                    {availableUsers.map((user) => (
                      <CommandItem
                        key={user.id}
                        value={`${user.name || ""} ${user.email || ""} ${user.family_name || ""}`}
                        onSelect={() => setSelectedUserId(user.id)}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedUserId === user.id ? "opacity-100" : "opacity-0"
                          )}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                          {user.family_name && (
                            <p className="text-xs text-muted-foreground">{user.family_name}</p>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            )}
          </div>

          {/* Headcount inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={10}
                value={adultsCount}
                onChange={(e) => setAdultsCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                type="number"
                min={0}
                max={10}
                value={childrenCount}
                onChange={(e) => setChildrenCount(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Total headcount: {adultsCount + childrenCount}
            {mode === "walkin" && " · Will be auto-checked-in"}
            {mode === "waitlist" && " · Will be added to the waitlist"}
            {mode === "rsvp" && " · Confirmed RSVP, not checked in"}
          </p>

          {isAtCapacity && mode !== "waitlist" && (
            <div className="rounded-md border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/20 px-3 py-2 text-xs text-yellow-900 dark:text-yellow-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Event is at capacity ({attendingCount}/{capacity}). Adding will exceed the limit.
              </span>
            </div>
          )}

          <Button
            onClick={() => walkInMutation.mutate()}
            disabled={!selectedUserId || walkInMutation.isPending}
            className="w-full h-11 gap-2"
          >
            {walkInMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "walkin" ? "Confirm Walk-In" : mode === "waitlist" ? "Add to Waitlist" : "Add RSVP"}
          </Button>

        </div>
      </DialogContent>
    </Dialog>
  );
}
