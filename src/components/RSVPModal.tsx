import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { useRSVPConcurrency, useEventRSVPs, useSignUpItems, useEventSelections, useMyRSVP, useMySelections } from "@/hooks/useRSVP";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Minus, Plus } from "lucide-react";
import GuestRequestsSection from "@/components/rsvp/GuestRequestsSection";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface RSVPModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RSVPModal({ event, open, onOpenChange }: RSVPModalProps) {
  const { user } = useAuth();
  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: signUpItems } = useSignUpItems(event.id);
  const { data: allSelections } = useEventSelections(event.id);
  const { data: mySelections } = useMySelections(myRSVP?.id);
  const { createRSVP, updateRSVP, cancelRSVP } = useRSVPConcurrency(event.id);

  const isEditing = !!myRSVP;

  const [guestsCount, setGuestsCount] = useState(1);
  const [selections, setSelections] = useState<Record<number, number>>({});

  // Sync state when data loads
  useEffect(() => {
    if (myRSVP) {
      setGuestsCount(myRSVP.guests_count);
    }
  }, [myRSVP]);

  useEffect(() => {
    if (mySelections) {
      const map: Record<number, number> = {};
      mySelections.forEach((s) => {
        map[Number(s.sign_up_item_id)] = s.quantity;
      });
      setSelections(map);
    }
  }, [mySelections]);

  // Calculate claimed quantities per item (excluding current user)
  const claimedPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    if (!allSelections) return map;
    for (const sel of allSelections) {
      // Exclude current user's selections from the count
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

  const handleSubmit = async () => {
    const selArray = Object.entries(selections)
      .filter(([, qty]) => qty > 0)
      .map(([id, qty]) => ({ sign_up_item_id: Number(id), quantity: qty }));

    try {
      if (isEditing && myRSVP) {
        await updateRSVP.mutateAsync({
          rsvpId: myRSVP.id,
          guests_count: guestsCount,
          selections: selArray,
        });
        toast.success("RSVP updated successfully!");
      } else {
        const result = await createRSVP.mutateAsync({
          guests_count: guestsCount,
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
          {/* Guest count */}
          <div>
            <Label className="mb-2 block text-sm font-medium">
              Number attending: <span className="font-bold text-primary">{guestsCount}</span>
            </Label>
            <Slider
              min={1}
              max={10}
              step={1}
              value={[guestsCount]}
              onValueChange={(v) => setGuestsCount(v[0])}
              className="mt-2"
            />
            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>10</span>
            </div>
          </div>

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
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={qty === 0}
                          onClick={() => updateSelection(itemId, -1)}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="w-8 text-center text-sm font-medium">{qty}</span>
                        <Button
                          type="button"
                          size="icon"
                          variant="outline"
                          className="h-8 w-8"
                          disabled={remaining <= 0}
                          onClick={() => updateSelection(itemId, 1)}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={isPending}>
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
