import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UtensilsCrossed } from "lucide-react";
import { useMemo } from "react";

interface PotluckMenuProps {
  eventId: string;
}

/** Shuffles an array using Fisher-Yates */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function PotluckMenu({ eventId }: PotluckMenuProps) {
  const { data: dishes } = useQuery({
    queryKey: ["potluck-menu", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("specific_food_item")
        .eq("event_id", eventId)
        .not("specific_food_item", "is", null)
        .neq("specific_food_item", "");
      if (error) throw error;
      return data
        .map((r) => r.specific_food_item!)
        .filter((item) => item.trim().length > 0);
    },
  });

  const shuffledDishes = useMemo(() => shuffle(dishes ?? []), [dishes]);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Current Menu</h4>
      </div>
      {shuffledDishes.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No items claimed yet. Be the first!
        </p>
      ) : (
        <ul className="space-y-1">
          {shuffledDishes.map((dish, i) => (
            <li key={i} className="text-sm text-foreground flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              {dish}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
