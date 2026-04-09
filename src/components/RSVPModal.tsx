import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useRSVPConcurrency, useSignUpItems, useEventSelections, useMyRSVP, useMySelections, useEventRSVPs } from "@/hooks/useRSVP";
import { useDependents } from "@/components/profile/DependentsSection";
import { useFamilyMembers } from "@/hooks/useFamilyMembers";
import { useDuplicateFoodCheck } from "@/hooks/useDuplicateFoodCheck";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Video, ExternalLink, AlertTriangle } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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

interface ItemSelection {
  selected: boolean;
  description: string;
}

export default function RSVPModal({ event, open, onOpenChange }: RSVPModalProps) {
  const { user } = useAuth();
  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: signUpItems } = useSignUpItems(event.id);
  const { data: allSelections } = useEventSelections(event.id);
  const { data: mySelections } = useMySelections(myRSVP?.id);
  const { data: dependents } = useDependents();
  const { data: familyMembers } = useFamilyMembers();
  const { createRSVP, updateRSVP, cancelRSVP } = useRSVPConcurrency(event.id);
  const { data: allRsvps } = useEventRSVPs(event.id);
  const { isDuplicate } = useDuplicateFoodCheck(allRsvps, user?.id);
  const isEditing = !!myRSVP;

  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectedDependentIds, setSelectedDependentIds] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Record<number, ItemSelection>>({});
  const [potluckDish, setPotluckDish] = useState("");
  const [potluckChoice, setPotluckChoice] = useState<string | null>(null);

  // Sync attendee state when data loads
  useEffect(() => {
    if (myRSVP && familyMembers && dependents) {
      const attendingDeps = (myRSVP.attending_dependents as any[]) || [];
      const memberIds = new Set<string>();
      const depIds = new Set<string>();

      for (const entry of attendingDeps) {
        if (entry.type === "family_member") {
          const found = familyMembers.find((m) => m.id === entry.id);
          if (found) memberIds.add(found.id);
        } else if (entry.type === "dependent") {
          const found = dependents.find((d) => d.id === entry.id);
          if (found) depIds.add(found.id);
        }
      }

      if (memberIds.size === 0 && attendingDeps.length === 0) {
        if (user) memberIds.add(user.id);
      }

      setSelectedMemberIds(memberIds);
      setSelectedDependentIds(depIds);
      setPotluckDish(myRSVP.specific_food_item || "");
      setPotluckChoice(myRSVP.specific_food_item ? "bringing" : (myRSVP.specific_food_item === null && isEditing ? "none" : null));
    } else if (!myRSVP && user) {
      setSelectedMemberIds(new Set([user.id]));
      setSelectedDependentIds(new Set());
      setPotluckDish("");
      setPotluckChoice(null);
    }
  }, [myRSVP, familyMembers, dependents, user]);

  // Sync sign-up selections
  useEffect(() => {
    if (mySelections) {
      const map: Record<number, ItemSelection> = {};
      mySelections.forEach((s) => {
        map[Number(s.sign_up_item_id)] = {
          selected: true,
          description: (s as any).description || "",
        };
      });
      setSelections(map);
    }
  }, [mySelections]);

  const guestsCount = selectedMemberIds.size + selectedDependentIds.size;

  const toggleMember = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleDependent = (id: string) => {
    setSelectedDependentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Calculate claimed counts per item (excluding current user)
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

  const showSignUpItems = event.has_potluck !== false && signUpItems && signUpItems.length > 0;
  const isPotluck = event.has_potluck === true;
  const onlineLink = event.online_link;
  const isVirtualEvent = !!onlineLink;

  const toggleItem = (itemId: number) => {
    setSelections((prev) => {
      const current = prev[itemId];
      if (current?.selected) {
        const { [itemId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [itemId]: { selected: true, description: "" } };
    });
  };

  const updateItemDescription = (itemId: number, description: string) => {
    setSelections((prev) => ({
      ...prev,
      [itemId]: { selected: true, description },
    }));
  };

  const isItemFull = (item: { id: number | string; quantity_limit: number }) => {
    const itemId = Number(item.id);
    if (item.quantity_limit === 0) return false;
    const claimed = claimedPerItem[itemId] || 0;
    const mine = selections[itemId]?.selected ? 1 : 0;
    return claimed + mine >= item.quantity_limit && !selections[itemId]?.selected;
  };

  const buildAttendingDependents = () => {
    const entries: { type: string; id: string; name: string; age?: number | null; dependent_type?: string }[] = [];

    if (familyMembers) {
      for (const member of familyMembers) {
        if (selectedMemberIds.has(member.id)) {
          entries.push({ type: "family_member", id: member.id, name: member.name || "Unknown" });
        }
      }
    }

    if (dependents) {
      const now = new Date();
      for (const dep of dependents) {
        if (selectedDependentIds.has(dep.id)) {
          let age: number | null = null;
          if (dep.date_of_birth) {
            const dob = new Date(dep.date_of_birth);
            age = Math.floor((now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
          }
          const depType = (dep as any).type || "child";
          entries.push({ type: "dependent", id: dep.id, name: dep.first_name, age, dependent_type: depType });
        }
      }
    }

    return entries.length > 0 ? entries : null;
  };

  const handleSubmit = async () => {
    if (guestsCount === 0) {
      toast.error("Please select at least one attendee.");
      return;
    }

    if (isPotluck && !potluckChoice) {
      toast.error("Please select a potluck option.");
      return;
    }

    if (isPotluck && potluckChoice === "bringing" && !potluckDish.trim()) {
      toast.error("Please enter what dish you're bringing.");
      return;
    }

    const selArray = Object.entries(selections)
      .filter(([, val]) => val.selected)
      .map(([id, val]) => ({
        sign_up_item_id: Number(id),
        quantity: 1,
        description: val.description || null,
      }));

    const attendingDeps = buildAttendingDependents();

    try {
      if (isEditing && myRSVP) {
        await updateRSVP.mutateAsync({
          rsvpId: myRSVP.id,
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          specific_food_item: potluckChoice === "bringing" ? potluckDish.trim() || null : null,
          selections: selArray,
        });
        toast.success("RSVP updated successfully!");
      } else {
        const result = await createRSVP.mutateAsync({
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          specific_food_item: potluckChoice === "bringing" ? potluckDish.trim() || null : null,
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
          {/* Virtual event join link */}
          {isVirtualEvent && (onlineLink || event.virtual_link) && (
            <a
              href={onlineLink || event.virtual_link || ""}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
            >
              <Video className="h-4 w-4 shrink-0" />
              Join Virtual Event
              <ExternalLink className="ml-auto h-3.5 w-3.5" />
            </a>
          )}
          {/* Attendee checklist */}
          <AttendeeChecklist
            familyMembers={familyMembers ?? []}
            selectedMemberIds={selectedMemberIds}
            onToggleMember={toggleMember}
            dependents={dependents ?? []}
            selectedDependentIds={selectedDependentIds}
            onToggleDependent={toggleDependent}
          />

          <p className="text-xs text-muted-foreground">
            Total attending: <span className="font-semibold text-foreground">{guestsCount}</span>
          </p>

          {/* Potluck contribution */}
          {isPotluck && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">
                What are you contributing to the potluck?
              </Label>
              <div className="space-y-2">
                <label
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    potluckChoice === "bringing"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="potluck-choice"
                    checked={potluckChoice === "bringing"}
                    onChange={() => setPotluckChoice("bringing")}
                    className="accent-primary h-4 w-4"
                  />
                  <span className="text-sm font-medium text-foreground">I'm bringing a dish</span>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                    potluckChoice === "none"
                      ? "border-primary bg-primary/5"
                      : "border-border bg-card hover:bg-muted/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="potluck-choice"
                    checked={potluckChoice === "none"}
                    onChange={() => { setPotluckChoice("none"); setPotluckDish(""); }}
                    className="accent-primary h-4 w-4"
                  />
                  <span className="text-sm font-medium text-foreground">None / can't bring anything this week</span>
                </label>
              </div>

              {potluckChoice === "bringing" && (
                <div className="space-y-2">
                  <Input
                    placeholder="e.g., Hummus, Knafeh, Paper Plates..."
                    value={potluckDish}
                    onChange={(e) => setPotluckDish(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Your name won't be shown — only the dish appears on the menu.
                  </p>
                  {potluckDish.trim().length > 0 && isDuplicate("", potluckDish) && (
                    <div className="flex items-start gap-2 rounded-md border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/30 px-3 py-2">
                      <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 shrink-0" />
                      <p className="text-xs text-yellow-800 dark:text-yellow-300">
                        Someone is already bringing a similar dish. Consider bringing something different to add variety!
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Sign-up categories with checkbox + description */}
          {showSignUpItems && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">What are you bringing?</Label>
              <div className="space-y-2">
                {signUpItems.map((item) => {
                  const itemId = Number(item.id);
                  const sel = selections[itemId];
                  const isSelected = sel?.selected ?? false;
                  const claimed = claimedPerItem[itemId] || 0;
                  const full = isItemFull(item);

                  return (
                    <div key={item.id} className="space-y-2">
                      <label
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          full
                            ? "border-border bg-muted/50 opacity-60 cursor-not-allowed"
                            : isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => !full && toggleItem(itemId)}
                          disabled={full}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">{item.item_name}</span>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity_limit === 0
                              ? "No limit"
                              : `${claimed + (isSelected ? 1 : 0)}/${item.quantity_limit} claimed`}
                            {full && " — Full"}
                          </p>
                        </div>
                      </label>

                      {isSelected && (
                        <div className="ml-8">
                          <Input
                            placeholder="What are you bringing? (e.g., Mac & Cheese)"
                            value={sel?.description || ""}
                            onChange={(e) => updateItemDescription(itemId, e.target.value)}
                            className="text-sm"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Guest Requests — only shown when editing */}
          {isEditing && <GuestRequestsSection eventId={event.id} event={event} />}
        </div>

        {/* Payment Required callout */}
        {(event as any).ticket_fee > 0 && (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-50 dark:bg-yellow-950/30 p-4 space-y-2">
            <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300 flex items-center gap-1.5">
              💰 Payment Required
            </p>
            <p className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
              Total Cost: {guestsCount > 1
                ? `${(event as any).ticket_fee} × ${guestsCount} = ${((event as any).ticket_fee * guestsCount).toFixed(0)} AED`
                : `${(event as any).ticket_fee} AED`}
            </p>
            {(event as any).payment_instructions && (
              <p className="text-xs text-yellow-800 dark:text-yellow-400 leading-relaxed">
                {(event as any).payment_instructions}
              </p>
            )}
            <p className="text-xs text-yellow-700 dark:text-yellow-500">
              Payment will be collected offline (cash or bank transfer)
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={handleSubmit} disabled={isPending || guestsCount === 0}>
            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {isEditing ? "Update RSVP" : (event as any).ticket_fee > 0 ? "Acknowledge & Confirm RSVP" : "Confirm RSVP"}
          </Button>
          {isEditing && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={isPending} className="text-destructive border-destructive/30 hover:bg-destructive/10">
                  Cancel RSVP
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your RSVP?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove your reservation for <span className="font-semibold">{event.title}</span> and release any sign-up items you claimed. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep RSVP</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleCancel}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Yes, Cancel RSVP
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
