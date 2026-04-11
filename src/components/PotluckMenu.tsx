import { useState } from "react";
import { UtensilsCrossed, ChevronDown } from "lucide-react";
import { useGroupedPotluckMenu } from "@/hooks/useGroupedPotluckMenu";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface PotluckMenuProps {
  eventId: string;
  prefetchedDishes?: string[];
}

export default function PotluckMenu({ eventId, prefetchedDishes }: PotluckMenuProps) {
  const grouped = useGroupedPotluckMenu(eventId, prefetchedDishes);
  const totalItems = grouped.reduce((sum, g) => sum + Math.max(g.items.length, 1), 0);
  const [open, setOpen] = useState(false);

  const isEmpty = totalItems === 0 || grouped.length === 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-3 rounded-lg border border-border bg-card">
      <CollapsibleTrigger className="flex w-full items-center justify-between p-4 text-left">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold text-card-foreground">
            Current Menu
            {!isEmpty && (
              <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                ({grouped.length} {grouped.length === 1 ? "category" : "categories"})
              </span>
            )}
          </h4>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4">
        {isEmpty ? (
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
      </CollapsibleContent>
    </Collapsible>
  );
}
