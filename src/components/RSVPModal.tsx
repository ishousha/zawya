import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useRSVPConcurrency, useSignUpItems, useEventSelections, useMyRSVP, useMySelections } from "@/hooks/useRSVP";
import { useDependents } from "@/components/profile/DependentsSection";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import { Label } from "@/components/ui/label";
import GuestRequestsSection from "@/components/rsvp/GuestRequestsSection";
import AttendeeChecklist from "@/components/rsvp/AttendeeChecklist";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface RSVPModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RSVPModal({ event, open, onOpenChange }: RSVPModalProps) {
  const { user, profile } = useAuth();
  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: signUpItems } = useSignUpItems(event.id);
  const { data: allSelections } = useEventSelections(event.id);
  const { data: mySelections } = useMySelections(myRSVP?.id);
  const { data: dependents } = useDependents();
  const { createRSVP, updateRSVP, cancelRSVP } = useRSVPConcurrency(event.id);

  const isEditing = !!myRSVP;

  const [selfAttending, setSelfAttending] = useState(true);
  const [selectedDependentIds, setSelectedDependentIds] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Record<number, number>>({});

  // Sync attendee state when data loads
  useEffect(() => {
    if (myRSVP && dependents) {
      const totalGuests = myRSVP.guests_count;
      // Self is always counted as 1, rest are dependents
      const kidCount = Math.max(0, totalGuests - 1);
      setSelfAttending(true);
      // Select first N dependents by default when editing
      const depIds = new Set<string>();
      dependents.slice(0, kidCount).forEach((d) => depIds.add(d.id));
      setSelectedDependentIds(depIds);
    } else if (!myRSVP) {
      setSelfAttending(true);
      setSelectedDependentIds(new Set());
    }
  }, [myRSVP, dependents]);

  useEffect(() => {
    if (mySelections) {
      const map: Record<number, number> = {};
      mySelections.forEach((s) => {
        map[Number(s.sign_up_item_id)] = s.quantity;
      });
      setSelections(map);
    }
  }, [mySelections]);

  const guestsCount = (selfAttending ? 1 : 0) + selectedDependentIds.size;

  const toggleDependent = (id: string) => {
    setSelectedDependentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calculate claimed quantities per item (excluding current user)
  const claimedPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    if (!allSelections) return map;
    for (const sel of allSelections) {
      if (myRSVP && sel.rsvp_id === myRSVP.id) continue;
      const itemId = Number(sel.sign_up_item_id);
      map[itemId] = (map[itemId] || 0) + sel.quantity;
    }
    return map;
  }, [allSelections, myRSVP]);

  const hasItems = signUpItems && signUpItems.length > 0;

  const updateSelection = (itemId: number, delta: number) => {
    setSelections((prev) => {
      const current = prev[itemId] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: next };
    });
  };

  const getRemaining = (item: { id: number | string; quantity_limit: number }) => {
    const itemId = Number(item.id);
    if (item.quantity_limit === 0) return Infinity;
    const claimed = claimedPerItem[itemId] || 0;
    const myQty = selections[itemId] || 0;
    return item.quantity_limit - claimed - myQty;
  };

  const buildAttendingDependents = () => {
    if (!dependents || selectedDependentIds.size === 0) return null;
    const now = new Date();
    return dependents
      .filter((d) => selectedDependentIds.has(d.id))
      .map((d) => {
        let age: number | null = null;
        if (d.date_of_birth) {
          const dob = new Date(d.date_of_birth);
          age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        }
        return { name: d.first_name, age };
      });
  };

  const handleSubmit = async () => {
    if (guestsCount === 0) {
      toast.error("Please select at least one attendee.");
      return;
    }

    const selArray = Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ sign_up_item_id: Number(id), quantity: qty }));

    const attendingDeps = buildAttendingDependents();

    try {
      if (isEditing && myRSVP) {
        await updateRSVP.mutateAsync({
          rsvpId: myRSVP.id,
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          selections: selArray,
        });
        toast.success("RSVP updated successfully!");
      } else {
        const result = await createRSVP.mutateAsync({
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          selections: selArray,
        });
        if (result.is_waitlisted) {
          toast.success("Added to the Waitlist", {
            description: "You'll be notified if a spot opens up.",
          });
        } else {
          toast.success("RSVP confirmed! Your ticket is ready.");
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      if (err?.message === "FULL") {
        toast.error("Event and Waitlist are Full", {
          description: "No more spots available at this time.",
        });
      } else {
        toast.error("Failed to save RSVP. Please try again.");
      }
    }
  };

  const handleCancel = async () => {
    if (!myRSVP) return;
    try {
      await cancelRSVP.mutateAsync(myRSVP.id);
      toast.success("RSVP cancelled.");
      onOpenChange(false);
    } catch {
      toast.error("Failed to cancel RSVP.");
    }
  };

  const isPending = createRSVP.isPending || updateRSVP.isPending || cancelRSVP.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {isEditing ? "Edit RSVP" : "RSVP"} — {event.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Attendee checklist */}
          <AttendeeChecklist
            userName={profile?.name || "Me"}
            dependents={dependents ?? []}
            selectedIds={selectedDependentIds}
            onToggle={toggleDependent}
            selfChecked={selfAttending}
            onSelfToggle={() => setSelfAttending((prev) => !prev)}
          />

          <p className="text-xs text-muted-foreground">
            Total attending: <span className="font-semibold text-foreground">{guestsCount}</span>
          </p>

          {/* Flexible sign-up items */}
          {hasItems && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">Sign-Up Items</Label>
              <div className="space-y-2">
                {signUpItems.map((item) => {
                  const itemId = Number(item.id);
                  const qty = selections[itemId] || 0;
                  const remaining = getRemaining(item);
                  const atLimit = remaining <= 0 && qty === 0;
                  const claimed = claimedPerItem[itemId] || 0;

                  return (
                    <div
                      key={item.id}
                      className={`flex items-center justify-between rounded-lg border p-3 ${
                        atLimit ? "border-border bg-muted/50 opacity-60" : "border-border bg-card"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{item.item_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity_limit === 0
                            ? "No limit"
                            : `${claimed + qty}/${item.quantity_limit} claimed`}
                          {atLimit && " — Full"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={qty === 0} onClick={() => updateSelection(itemId, -1)}>
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{qty}</span>
                        <Button type="button" size="icon" variant="outline" className="h-8 w-8" disabled={remaining <= 0} onClick={() => updateSelection(itemId, 1)}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Guest Requests — only shown when editing */}
          {isEditing && <GuestRequestsSection eventId={event.id} />}
        </div>

        {/* Fee notice */}
        {(event as any).ticket_fee > 0 && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-center">
            <p className="text-sm font-semibold text-primary">
              Fee: {(event as any).ticket_fee} AED
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Payment will be collected at the event
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={isPending || guestsCount === 0}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? "Update RSVP" : "Confirm RSVP"}
          </Button>
          {isEditing && (
            <Button variant="outline" onClick={handleCancel} disabled={isPending} className="text-destructive">
              Cancel RSVP
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
