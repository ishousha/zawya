import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { useRSVPConcurrency, useEventRSVPs, usePotluckConfig, useMyRSVP } from "@/hooks/useRSVP";
import { useDuplicateFoodCheck } from "@/hooks/useDuplicateFoodCheck";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, AlertTriangle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];
type PotluckCategory = Database["public"]["Enums"]["potluck_category"];

const CATEGORY_LABELS: Record<PotluckCategory, string> = {
  main: "Main Dish",
  side: "Side Dish",
  dessert: "Dessert",
  drinks: "Drinks",
};

interface RSVPModalProps {
  event: Event;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function RSVPModal({ event, open, onOpenChange }: RSVPModalProps) {
  const { user } = useAuth();
  const { data: rsvps } = useEventRSVPs(event.id);
  const { data: potluckConfigs } = usePotluckConfig(event.id);
  const { data: myRSVP } = useMyRSVP(event.id);
  const { createRSVP, updateRSVP, cancelRSVP } = useRSVPConcurrency(event.id);
  const { claimedItemsByCategory, isDuplicate } = useDuplicateFoodCheck(rsvps, user?.id);

  const isEditing = !!myRSVP;

  const [guestsCount, setGuestsCount] = useState(myRSVP?.guests_count ?? 1);
  const [selectedCategory, setSelectedCategory] = useState<PotluckCategory | "">(
    myRSVP?.potluck_category ?? ""
  );
  const [foodItem, setFoodItem] = useState(myRSVP?.specific_food_item ?? "");
  const [foodWarning, setFoodWarning] = useState("");

  // Sync state when myRSVP loads
  useState(() => {
    if (myRSVP) {
      setGuestsCount(myRSVP.guests_count);
      setSelectedCategory(myRSVP.potluck_category ?? "");
      setFoodItem(myRSVP.specific_food_item ?? "");
    }
  });

  // Calculate slots used per category
  const slotsUsed = useMemo(() => {
    const map: Record<string, number> = {};
    if (!rsvps) return map;
    for (const rsvp of rsvps) {
      if (rsvp.potluck_category) {
        map[rsvp.potluck_category] = (map[rsvp.potluck_category] || 0) + 1;
      }
    }
    // Don't count current user's slot if editing
    if (isEditing && myRSVP?.potluck_category) {
      const cat = myRSVP.potluck_category;
      map[cat] = Math.max(0, (map[cat] || 0) - 1);
    }
    return map;
  }, [rsvps, isEditing, myRSVP]);

  const hasPotluck = potluckConfigs && potluckConfigs.length > 0;

  const handleFoodItemChange = (value: string) => {
    setFoodItem(value);
    if (selectedCategory && value.trim() && isDuplicate(selectedCategory, value)) {
      setFoodWarning("This item is already claimed by another member.");
    } else {
      setFoodWarning("");
    }
  };

  const handleSubmit = async () => {
    if (foodWarning) {
      toast.error("Please choose a different food item — this one is already taken.");
      return;
    }

    try {
      if (isEditing && myRSVP) {
        await updateRSVP.mutateAsync({
          rsvpId: myRSVP.id,
          guests_count: guestsCount,
          potluck_category: selectedCategory || null,
          specific_food_item: foodItem.trim() || null,
        });
        toast.success("RSVP updated successfully!");
      } else {
        await createRSVP.mutateAsync({
          guests_count: guestsCount,
          potluck_category: selectedCategory || null,
          specific_food_item: foodItem.trim() || null,
        });
        toast.success("RSVP confirmed! Your ticket is ready.");
      }
      onOpenChange(false);
    } catch {
      toast.error("Failed to save RSVP. Please try again.");
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

          {/* Potluck section */}
          {hasPotluck && (
            <div className="space-y-3">
              <Label className="block text-sm font-medium">Potluck Contribution</Label>

              <Select
                value={selectedCategory}
                onValueChange={(v) => {
                  setSelectedCategory(v as PotluckCategory);
                  setFoodItem("");
                  setFoodWarning("");
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {potluckConfigs.map((config) => {
                    const used = slotsUsed[config.category] || 0;
                    const isFull = used >= config.max_slots;
                    return (
                      <SelectItem
                        key={config.id}
                        value={config.category}
                        disabled={isFull}
                      >
                        {CATEGORY_LABELS[config.category]}
                        <span className="ml-2 text-xs text-muted-foreground">
                          ({used}/{config.max_slots}{isFull ? " — Full" : ""})
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {/* Food item input */}
              {selectedCategory && (
                <div>
                  <Input
                    placeholder="What will you bring? (e.g., Biryani)"
                    value={foodItem}
                    onChange={(e) => handleFoodItemChange(e.target.value)}
                  />
                  {foodWarning && (
                    <p className="mt-1 flex items-center gap-1 text-xs text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      {foodWarning}
                    </p>
                  )}
                </div>
              )}

              {/* Claimed items read-only list */}
              {selectedCategory && claimedItemsByCategory[selectedCategory]?.length > 0 && (
                <div className="rounded-md border border-border bg-muted/50 p-3">
                  <p className="mb-1.5 text-xs font-medium text-muted-foreground">
                    Already claimed in {CATEGORY_LABELS[selectedCategory as PotluckCategory]}:
                  </p>
                  <ul className="space-y-1">
                    {claimedItemsByCategory[selectedCategory]
                      .filter((i) => i.userId !== user?.id)
                      .map((item, idx) => (
                        <li key={idx} className="text-sm text-foreground">
                          • {item.item}
                        </li>
                      ))}
                  </ul>
                </div>
              )}
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
