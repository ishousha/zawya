import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AGE_GROUP_LABELS, type AgeGroupKey } from "@/lib/age-group-labels";
import { capacityToastFromError } from "@/lib/rsvp-errors";

interface RsvpRow {
  id: string;
  event_id: string;
  user_id: string;
  guests_count: number;
  attending_dependents: any;
  status: string;
  is_waitlisted: boolean | null;
  checked_in: boolean | null;
  profile?: { name?: string | null; email?: string | null } | null;
}

interface EditDep {
  name: string;
  type: "dependent" | "family_member" | "elder";
  age_group?: AgeGroupKey | null;
  age?: number | null;
  id?: string | null; // family_member id, preserved
}

export interface RecordedEditAction {
  kind: "edit";
  rsvpId: string;
  userId: string;
  name: string;
  email: string | null;
  previous: {
    guests_count: number;
    attending_dependents: any;
    status: string;
    is_waitlisted: boolean;
    checked_in: boolean;
  };
  at: number;
}

interface Props {
  rsvp: RsvpRow | null;
  eventTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  capacity?: number | null;
  attendingCount?: number; // total attending seats (excluding host)
  hostId?: string | null;
  onActionRecorded?: (action: RecordedEditAction) => void;
  onProjectionChange?: (projectedAttending: number | null) => void;
}

const STATUS_OPTIONS: { value: "attending" | "waitlisted" | "cancelled"; label: string }[] = [
  { value: "attending", label: "Attending" },
  { value: "waitlisted", label: "Waitlisted" },
  { value: "cancelled", label: "Cancelled" },
];

export default function EditRsvpDialog({ rsvp, eventTitle, open, onOpenChange, capacity, attendingCount, hostId, onActionRecorded, onProjectionChange }: Props) {
  const queryClient = useQueryClient();
  const [adults, setAdults] = useState(1);
  const [deps, setDeps] = useState<EditDep[]>([]);
  const [status, setStatus] = useState<"attending" | "waitlisted" | "cancelled">("attending");
  const [checkedIn, setCheckedIn] = useState(false);

  useEffect(() => {
    if (!rsvp) return;
    const incoming = (rsvp.attending_dependents as EditDep[] | null) ?? [];
    // Filter out the member themselves if they were stored as a "family_member" entry
    // (RSVPModal writes a self-entry on solo RSVPs; we don't want them listed as a dependent).
    const filtered = incoming.filter(
      (d) => !(d.type === "family_member" && d.id === rsvp.user_id)
    );
    const total = rsvp.guests_count ?? 1;
    setDeps(filtered.map((d) => ({ ...d })));
    setAdults(Math.max(1, total - filtered.length));
    const s = (rsvp.is_waitlisted ? "waitlisted" : (rsvp.status as any)) || "attending";
    setStatus(s === "waitlisted" || s === "cancelled" ? s : "attending");
    setCheckedIn(!!rsvp.checked_in);
  }, [rsvp?.id, open]);

  const save = useMutation({
    mutationFn: async () => {
      if (!rsvp) throw new Error("No RSVP");
      const cleanedDeps = deps.map((d) => ({
        name: d.name?.trim() || "Guest",
        type: d.type || "dependent",
        age_group: d.age_group ?? null,
        age: d.age ?? null,
        ...(d.id ? { id: d.id } : {}),
      }));
      const total = Math.max(1, adults + cleanedDeps.length);
      const isWaitlist = status === "waitlisted";
      const dbStatus = status === "cancelled" ? "cancelled" : isWaitlist ? "waitlisted" : "attending";

      // Snapshot previous state for undo
      const previous = {
        guests_count: rsvp.guests_count,
        attending_dependents: rsvp.attending_dependents ?? null,
        status: rsvp.status,
        is_waitlisted: !!rsvp.is_waitlisted,
        checked_in: !!rsvp.checked_in,
      };

      const { error } = await supabase
        .from("rsvps")
        .update({
          guests_count: total,
          attending_dependents: cleanedDeps.length > 0 ? cleanedDeps : null,
          status: dbStatus as any,
          is_waitlisted: isWaitlist,
          checked_in: status === "cancelled" ? false : checkedIn,
        })
        .eq("id", rsvp.id);
      if (error) throw error;

      const { data: userData } = await supabase.auth.getUser();
      const actorId = userData.user?.id;
      if (actorId) {
        await supabase.from("admin_activity_log").insert({
          actor_id: actorId,
          action: "rsvp_admin_edit",
          target_user_id: rsvp.user_id,
          target_user_name: rsvp.profile?.name ?? null,
          target_user_email: rsvp.profile?.email ?? null,
          details: {
            event_id: rsvp.event_id,
            event_title: eventTitle,
            rsvp_id: rsvp.id,
            guests_count: total,
            status: dbStatus,
            is_waitlisted: isWaitlist,
            checked_in: status === "cancelled" ? false : checkedIn,
            previous,
          },
        });
      }
      return { previous };
    },
    onSuccess: (result) => {
      const evId = rsvp?.event_id;
      const rsvpId = rsvp?.id;
      const previous = result?.previous;
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", evId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", evId] });
      queryClient.invalidateQueries({ queryKey: ["event-rsvp-counts", evId] });
      queryClient.invalidateQueries({ queryKey: ["door-attendees", evId] });
      queryClient.invalidateQueries({ queryKey: ["existing-rsvp-users", evId] });
      const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ["admin-rsvps", evId] });
        queryClient.invalidateQueries({ queryKey: ["host-rsvps", evId] });
        queryClient.invalidateQueries({ queryKey: ["event-rsvp-counts", evId] });
        queryClient.invalidateQueries({ queryKey: ["door-attendees", evId] });
        queryClient.invalidateQueries({ queryKey: ["existing-rsvp-users", evId] });
      };
      // Surface action to parent (used for global "Undo last change" on error toasts)
      if (previous && rsvpId && rsvp) {
        onActionRecorded?.({
          kind: "edit",
          rsvpId,
          userId: rsvp.user_id,
          name: rsvp.profile?.name ?? rsvp.profile?.email ?? "Member",
          email: rsvp.profile?.email ?? null,
          previous,
          at: Date.now(),
        });
      }
      toast.success("RSVP updated", {
        duration: 10000,
        action: previous && rsvpId
          ? {
              label: "Undo",
              onClick: async () => {
                const { error } = await supabase
                  .from("rsvps")
                  .update({
                    guests_count: previous.guests_count,
                    attending_dependents: previous.attending_dependents,
                    status: previous.status as any,
                    is_waitlisted: previous.is_waitlisted,
                    checked_in: previous.checked_in,
                  })
                  .eq("id", rsvpId);
                if (error) {
                  const cap = capacityToastFromError(error);
                  if (cap) {
                    toast.error("Can't undo — " + cap.title.toLowerCase(), { description: cap.description });
                  } else {
                    toast.error("Undo failed", { description: error.message });
                  }
                  return;
                }
                const { data: u } = await supabase.auth.getUser();
                if (u.user?.id) {
                  await supabase.from("admin_activity_log").insert({
                    actor_id: u.user.id,
                    action: "rsvp_admin_undo",
                    target_user_id: rsvp!.user_id,
                    target_user_name: rsvp!.profile?.name ?? null,
                    target_user_email: rsvp!.profile?.email ?? null,
                    details: { event_id: evId, rsvp_id: rsvpId, undone: "rsvp_admin_edit" },
                  });
                }
                invalidate();
                toast.success("RSVP edit undone");
              },
            }
          : undefined,
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      const cap = capacityToastFromError(err);
      if (cap) {
        toast.error(cap.title, { description: cap.description });
        return;
      }
      const msg = String(err?.message || "Failed to update RSVP");
      if (msg.includes("RSVP_DUPLICATE_COVERED") || msg.includes("RSVP_DUPLICATE_MEMBER")) {
        toast.error("Family conflict", { description: msg.replace(/^.*?:\s*/, "") });
      } else {
        toast.error(msg);
      }
    },
  });

  // Capacity projection
  const isHost = !!(hostId && rsvp && rsvp.user_id === hostId);
  const newTotal = Math.max(1, adults + deps.length);
  const previousAttendingFromThis =
    rsvp && rsvp.status === "attending" && !rsvp.is_waitlisted && !isHost
      ? (rsvp.guests_count ?? 0)
      : 0;
  const otherAttending = Math.max(0, (attendingCount ?? 0) - previousAttendingFromThis);
  const willCountTowardCapacity = status === "attending" && !isHost;
  const projectedTotal = otherAttending + (willCountTowardCapacity ? newTotal : 0);
  const overCapacity =
    typeof capacity === "number" && capacity > 0 && willCountTowardCapacity && projectedTotal > capacity;

  // Notify parent of live capacity projection while open
  useEffect(() => {
    if (!onProjectionChange) return;
    if (!open) { onProjectionChange(null); return; }
    onProjectionChange(projectedTotal);
    return () => onProjectionChange(null);
  }, [open, projectedTotal, onProjectionChange]);

  const addDep = () =>
    setDeps((d) => [...d, { name: "", type: "dependent", age_group: "child_4_12" }]);
  const updateDep = (i: number, patch: Partial<EditDep>) =>
    setDeps((d) => d.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const removeDep = (i: number) => setDeps((d) => d.filter((_, idx) => idx !== i));

  if (!rsvp) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit RSVP</DialogTitle>
          <DialogDescription className="text-xs">
            {rsvp.profile?.name || rsvp.profile?.email || "Member"} · {eventTitle}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={20}
                value={adults}
                onChange={(e) => setAdults(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
              />
              <p className="text-[11px] text-muted-foreground">Includes the member.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="z-[60]">
                  {STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Set to <strong>Cancelled</strong> to free the seat without deleting the record, or use the trash icon in the list to remove it entirely.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-md border px-3 py-2">
            <div>
              <Label className="text-sm">Checked in</Label>
              <p className="text-[11px] text-muted-foreground">
                {status === "cancelled" ? "Cancelled RSVPs cannot be checked in." : "Mark the party as having arrived."}
              </p>
            </div>
            <Switch
              checked={checkedIn}
              disabled={status === "cancelled"}
              onCheckedChange={setCheckedIn}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Dependents & guests ({deps.length})</Label>
              <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addDep}>
                <Plus className="h-3.5 w-3.5" /> Add
              </Button>
            </div>
            {deps.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No dependents on this RSVP.</p>
            )}
            <div className="space-y-2">
              {deps.map((d, i) => {
                const isFamilyMember = d.type === "family_member";
                return (
                  <div key={i} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                    <Input
                      value={d.name}
                      placeholder="Name"
                      onChange={(e) => updateDep(i, { name: e.target.value })}
                      className="h-8 text-sm"
                      disabled={isFamilyMember}
                    />
                    {isFamilyMember ? (
                      <Badge variant="secondary" className="text-[10px] shrink-0">Family</Badge>
                    ) : (
                      <Select
                        value={d.age_group || "child_4_12"}
                        onValueChange={(v) => updateDep(i, { age_group: v as AgeGroupKey })}
                      >
                        <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent position="popper" sideOffset={4} className="z-[60]">
                          {(Object.keys(AGE_GROUP_LABELS) as AgeGroupKey[]).map((k) => (
                            <SelectItem key={k} value={k} className="text-xs">
                              {AGE_GROUP_LABELS[k]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => removeDep(i)}
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Total party size: <strong>{adults + deps.length}</strong>
            </p>
          </div>

          {typeof capacity === "number" && capacity > 0 && (
            <div className={`rounded-md border px-3 py-2 text-xs ${overCapacity ? "border-destructive/40 bg-destructive/5 text-destructive" : "text-muted-foreground"}`}>
              {isHost ? (
                <>Host RSVPs don't consume capacity ({attendingCount ?? 0} / {capacity} used).</>
              ) : !willCountTowardCapacity ? (
                <>{status === "waitlisted" ? "Waitlisted" : "Cancelled"} — won't consume capacity ({attendingCount ?? 0} / {capacity} used).</>
              ) : (
                <>
                  Capacity: <strong>{projectedTotal} / {capacity}</strong> after save
                  {overCapacity && (
                    <> · over by <strong>{projectedTotal - capacity}</strong>. Reduce party size or move to Waitlist.</>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || overCapacity}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
