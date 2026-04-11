import { UtensilsCrossed } from "lucide-react";
import { useGroupedPotluckMenu } from "@/hooks/useGroupedPotluckMenu";

interface PotluckMenuProps {
  eventId: string;
  prefetchedDishes?: string[];
}

export default function PotluckMenu({ eventId, prefetchedDishes }: PotluckMenuProps) {
  const grouped = useGroupedPotluckMenu(eventId, prefetchedDishes);
  const totalItems = grouped.reduce((sum, g) => sum + Math.max(g.items.length, 1), 0);

  return (
    <div className="mt-3 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-2">
        <UtensilsCrossed className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-card-foreground">Current Menu</h4>
      </div>
      {totalItems === 0 || grouped.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          No items claimed yet. Be the first!
        </p>
      ) : (
        <ul className="space-y-1.5">
          {grouped.map((g) => {
            const count = g.items.length;
            const dishList = count > 0 ? g.items.join(", ") : "Undecided";
            return (
              <li key={g.category} className="text-sm text-foreground">
                <span className="text-primary mr-1.5">•</span>
                <span className="font-semibold">{g.category}</span>
                {count > 0 && (
                  <span className="text-muted-foreground ml-1">
                    ({count} {count === 1 ? "item" : "items"})
                  </span>
                )}
                <span className="text-muted-foreground">: </span>
                <span>{dishList}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
