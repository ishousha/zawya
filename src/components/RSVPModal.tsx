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
import { useRSVPConcurrency, useSignUpItems, useEventSignUpClaims, useMyRSVP, useMySelections, useEventRSVPs } from "@/hooks/useRSVP";
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
import CurrentMenuPreview from "@/components/rsvp/CurrentMenuPreview";
import { useGroupedPotluckMenu } from "@/hooks/useGroupedPotluckMenu";
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
  const { user, profile } = useAuth();
  const { data: myRSVP } = useMyRSVP(event.id);
  const { data: signUpItems } = useSignUpItems(event.id);
  const { data: claimsAgg } = useEventSignUpClaims(event.id);
  const { data: mySelections } = useMySelections(myRSVP?.id);
  const { data: dependents } = useDependents();
  const { data: familyMembers } = useFamilyMembers();
  const { createRSVP, updateRSVP, cancelRSVP } = useRSVPConcurrency(event.id);
  const { data: allRsvps } = useEventRSVPs(event.id);
  const { isDuplicate } = useDuplicateFoodCheck(allRsvps, user?.id);
  const groupedMenu = useGroupedPotluckMenu(event.id);
  const isEditing = !!myRSVP;

  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [selectedDependentIds, setSelectedDependentIds] = useState<Set<string>>(new Set());
  const [selections, setSelections] = useState<Record<number, ItemSelection>>({});
  const [potluckDish, setPotluckDish] = useState("");
  const [potluckChoice, setPotluckChoice] = useState<string>("bringing");

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
      if (myRSVP.specific_food_item || Object.keys(selections).length > 0) {
        setPotluckChoice("bringing");
      } else if (isEditing) {
        setPotluckChoice("none");
      }
    } else if (!myRSVP && user) {
      setSelectedMemberIds(new Set([user.id]));
      setSelectedDependentIds(new Set());
      setPotluckDish("");
      setPotluckChoice("bringing");
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

  // Calculate claimed counts per item (excluding current user's own selections)
  const claimedPerItem = useMemo(() => {
    const map: Record<number, number> = {};
    if (!claimsAgg) return map;
    for (const row of claimsAgg) {
      map[Number(row.sign_up_item_id)] = row.total_quantity;
    }
    if (mySelections) {
      for (const sel of mySelections) {
        const itemId = Number(sel.sign_up_item_id);
        map[itemId] = Math.max(0, (map[itemId] ?? 0) - sel.quantity);
      }
    }
    return map;
  }, [claimsAgg, mySelections]);

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

  const isItemAtTarget = (item: { id: number | string; quantity_limit: number }) => {
    const itemId = Number(item.id);
    if (item.quantity_limit === 0) return false;
    const claimed = claimedPerItem[itemId] || 0;
    return claimed >= item.quantity_limit;
  };

  // Special "Other / Surprise Dish" virtual item ID
  const OTHER_ITEM_ID = -1;

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

    if (isPotluck && potluckChoice === "bringing") {
      if (showSignUpItems) {
        const hasSelection = Object.values(selections).some((s) => s.selected);
        if (!hasSelection) {
          toast.error("Please select at least one potluck item, or click 'I cannot bring anything this week'.");
          return;
        }
      } else if (!potluckDish.trim()) {
        toast.error("Please enter what dish you're bringing, or click 'I cannot bring anything this week'.");
        return;
      }
    }


    // Filter out the virtual "Other" item (id = -1) from DB selections
    const otherDish = selections[OTHER_ITEM_ID]?.selected ? (selections[OTHER_ITEM_ID]?.description || "Surprise Dish") : null;

    const selArray = Object.entries(selections)
      .filter(([id, val]) => val.selected && Number(id) !== OTHER_ITEM_ID)
      .map(([id, val]) => ({
        sign_up_item_id: Number(id),
        quantity: 1,
        description: val.description || null,
      }));

    // Combine potluckDish and "Other" item description into specific_food_item
    const foodItem = potluckChoice === "bringing"
      ? [potluckDish.trim(), otherDish].filter(Boolean).join(", ") || null
      : null;

    const attendingDeps = buildAttendingDependents();

    try {
      if (isEditing && myRSVP) {
        await updateRSVP.mutateAsync({
          rsvpId: myRSVP.id,
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          specific_food_item: foodItem,
          selections: selArray,
        });
        toast.success("RSVP updated successfully!");
      } else {
        const result = await createRSVP.mutateAsync({
          guests_count: guestsCount,
          attending_dependents: attendingDeps,
          specific_food_item: foodItem,
          selections: selArray,
        });
        if (result.status === "waitlisted") {
          toast.success("Added to the Waitlist", {
            description: "You'll be notified if a spot opens up.",
          });
        } else {
          toast.success("RSVP confirmed! Your ticket is ready.");
        }
      }
      onOpenChange(false);
    } catch (err: any) {
      console.error("RSVP error:", err);
      if (err?.message === "FULL") {
        toast.error("Event and Waitlist are Full", {
          description: "No more spots available at this time.",
        });
      } else {
        toast.error("Failed to save RSVP", {
          description: err?.message || "Please try again.",
        });
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

  // Gender-restriction guard
  const audienceGender = (event as any).audience_gender as string | undefined;
  const userGender = (profile as any)?.gender as string | undefined;
  const isAdminOrMod = profile?.role === "admin" || profile?.role === "moderator";
  const genderBlocked =
    !isAdminOrMod &&
    !isEditing &&
    ((audienceGender === "Brothers Only" && userGender !== "male") ||
      (audienceGender === "Sisters Only" && userGender !== "female"));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">
            {isEditing ? "Edit RSVP" : "RSVP"} — {event.title}
          </DialogTitle>
        </DialogHeader>

        {genderBlocked ? (
          <div className="space-y-4 py-4 text-center">
            <p className="text-sm text-foreground">
              {audienceGender === "Brothers Only"
                ? "This gathering is for brothers only."
                : "This gathering is for sisters only."}
            </p>
            {!userGender && (
              <p className="text-xs text-muted-foreground">
                Add your gender in your profile to RSVP gender-restricted events.
              </p>
            )}
            <Button onClick={() => onOpenChange(false)} className="w-full">Close</Button>
          </div>
        ) : (
        <>
        <div className="space-y-5 py-2">
          {/* Virtual event link removed — shown only on EventCard after RSVP + 15-min gate */}

          {/* Attendee checklist — filter dependents by event age groups */}
          {(() => {
            const rawGroups = (event as any).age_groups as string[] | undefined;
            const legacyGroup = (event as any).age_group as string | undefined;
            const ageGroups: string[] =
              Array.isArray(rawGroups) && rawGroups.length > 0
                ? rawGroups
                : legacyGroup
                ? [legacyGroup]
                : ["All Ages"];

            const allowsEveryone = ageGroups.includes("All Ages");
            const allowsKids = ageGroups.includes("Kids (Under 12)");
            const allowsYouth = ageGroups.includes("Youth (13-18)");
            const allowsAdults =
              ageGroups.includes("Adults (18+)") ||
              ageGroups.includes("Young Adults (18-30)");

            const allDeps = dependents ?? [];

            const depMatches = (dep: any) => {
              if (allowsEveryone) return true;

              // Compute age (if DOB known) and use age_group field as a hint
              let age: number | null = null;
              if (dep.date_of_birth) {
                const dob = new Date(dep.date_of_birth);
                age = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
              }
              const depAgeGroup = dep.age_group as string | null;

              const isInfant = depAgeGroup === "infant_0_3" || (age !== null && age <= 3);
              const isChild = depAgeGroup === "child_4_12" || (age !== null && age >= 4 && age <= 12);
              const isYouth = depAgeGroup === "youth_13_17" || (age !== null && age >= 13 && age <= 17);
              const isAdult = depAgeGroup === "adult_18_plus" || (age !== null && age >= 18) || dep.type === "elder";

              if (allowsKids && (isInfant || isChild)) return true;
              if (allowsYouth && isYouth) return true;
              if (allowsAdults && isAdult) return true;

              // Unknown / no age info — show by default to avoid false-hides
              if (age === null && !depAgeGroup) return true;

              return false;
            };

            const filteredDeps = allDeps.filter(depMatches);
            const hiddenCount = allDeps.length - filteredDeps.length;

            return (
              <>
                <AttendeeChecklist
                  familyMembers={familyMembers ?? []}
                  selectedMemberIds={selectedMemberIds}
                  onToggleMember={toggleMember}
                  dependents={filteredDeps}
                  selectedDependentIds={selectedDependentIds}
                  onToggleDependent={toggleDependent}
                />
                {hiddenCount > 0 && (
                  <p className="text-xs text-muted-foreground mt-2 italic">
                    Some family members are hidden due to event age restrictions.
                  </p>
                )}
              </>
            );
          })()}

          <p className="text-xs text-muted-foreground">
            Total attending: <span className="font-semibold text-foreground">{guestsCount}</span>
          </p>

          {/* Potluck contribution — default-to-yes pattern */}
          {isPotluck && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">Potluck Contribution</Label>

              <CurrentMenuPreview grouped={groupedMenu} />

              <p className="text-xs italic text-muted-foreground leading-relaxed">
                Our gatherings are made beautiful by everyone's contributions. Please select an item to share if you can!
              </p>

              {potluckChoice !== "none" && showSignUpItems && (
                <div className="animate-fade-in space-y-2">
                  {signUpItems!.map((item) => {
                    const itemId = Number(item.id);
                    const sel = selections[itemId];
                    const isSelected = sel?.selected ?? false;
                    const claimed = claimedPerItem[itemId] || 0;
                    const atTarget = isItemAtTarget(item);

                    return (
                      <div key={item.id} className="min-h-[3.5rem]">
                        <label
                          className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors min-h-[3rem] ${
                            isSelected
                              ? "border-primary bg-primary/5"
                              : "border-border bg-card hover:bg-muted/30"
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleItem(itemId)}
                          />
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-foreground">
                              {item.item_name}
                              {atTarget && (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Target Reached)</span>
                              )}
                            </span>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity_limit === 0
                                ? "No limit"
                                : `${claimed + (isSelected ? 1 : 0)}/${item.quantity_limit} claimed`}
                            </p>
                          </div>
                        </label>

                        {isSelected && atTarget && (
                          <p className="ml-8 mt-1 text-xs text-muted-foreground italic">
                            We already have enough items in this category, but extra contributions are always welcome!
                          </p>
                        )}

                        {isSelected && (
                          <div className="ml-8 mt-2">
                            <Input
                              placeholder="What dish? (e.g., Mac & Cheese)"
                              value={sel?.description || ""}
                              onChange={(e) => updateItemDescription(itemId, e.target.value)}
                              className="text-sm h-10"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Other / Surprise Dish option */}
                  <div>
                    <label
                      className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                        selections[OTHER_ITEM_ID]?.selected
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/30"
                      }`}
                    >
                      <Checkbox
                        checked={selections[OTHER_ITEM_ID]?.selected ?? false}
                        onCheckedChange={() => toggleItem(OTHER_ITEM_ID)}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">Other / Surprise Dish</span>
                        <p className="text-xs text-muted-foreground">Doesn't fit the categories above? Bring anything!</p>
                      </div>
                    </label>

                    {selections[OTHER_ITEM_ID]?.selected && (
                      <div className="animate-fade-in ml-8 mt-2">
                        <Input
                          placeholder="What are you bringing?"
                          value={selections[OTHER_ITEM_ID]?.description || ""}
                          onChange={(e) => updateItemDescription(OTHER_ITEM_ID, e.target.value)}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Plain text input when no sign-up items configured */}
              {potluckChoice !== "none" && !showSignUpItems && (
                <div className="animate-fade-in space-y-2">
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

              {/* Ghost opt-out / opt-back-in toggle */}
              {potluckChoice === "none" ? (
                <button
                  type="button"
                  onClick={() => setPotluckChoice("bringing")}
                  className="text-xs text-primary underline underline-offset-2 hover:text-primary/80 transition-colors pt-1"
                >
                  Actually, I can bring something →
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setPotluckChoice("none");
                    setPotluckDish("");
                    setSelections({});
                  }}
                  className="text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors pt-1"
                >
                  I cannot bring anything this week
                </button>
              )}
            </div>
          )}

          {/* Sign-up items for NON-potluck events */}
          {!isPotluck && showSignUpItems && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">Sign-up Items</Label>
              <div className="space-y-2">
                {signUpItems!.map((item) => {
                  const itemId = Number(item.id);
                  const sel = selections[itemId];
                  const isSelected = sel?.selected ?? false;
                  const claimed = claimedPerItem[itemId] || 0;
                  const atTarget = isItemAtTarget(item);

                  return (
                    <div key={item.id}>
                      <label
                        className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          isSelected
                            ? "border-primary bg-primary/5"
                            : "border-border bg-card hover:bg-muted/30"
                        }`}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(itemId)}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-foreground">
                            {item.item_name}
                            {atTarget && (
                              <span className="ml-1.5 text-xs font-normal text-muted-foreground">(Target Reached)</span>
                            )}
                          </span>
                          <p className="text-xs text-muted-foreground">
                            {item.quantity_limit === 0
                              ? "No limit"
                              : `${claimed + (isSelected ? 1 : 0)}/${item.quantity_limit} claimed`}
                          </p>
                        </div>
                      </label>

                      {isSelected && atTarget && (
                        <p className="ml-8 mt-1 text-xs text-muted-foreground italic">
                          We already have enough items in this category, but extra contributions are always welcome!
                        </p>
                      )}

                      {isSelected && (
                        <div className="animate-fade-in ml-8 mt-2">
                          <Input
                            placeholder="Details (optional)"
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
                <Button variant="destructive" disabled={isPending} className="w-full">
                  Cancel My RSVP
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel your RSVP?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure? This will release your spot and any potluck item you signed up for. This action cannot be undone.
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
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
