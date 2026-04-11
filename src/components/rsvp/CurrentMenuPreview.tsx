import { UtensilsCrossed } from "lucide-react";
import type { GroupedCategory } from "@/hooks/useGroupedPotluckMenu";

interface CurrentMenuPreviewProps {
  grouped: GroupedCategory[];
}

export default function CurrentMenuPreview({ grouped }: CurrentMenuPreviewProps) {
  const isEmpty = grouped.length === 0;

  return (
    <div className="rounded-md bg-muted/50 border border-border p-3">
      <div className="flex items-center gap-1.5 mb-1.5">
        <UtensilsCrossed className="h-3.5 w-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Currently on the Menu</span>
      </div>
      {isEmpty ? (
        <p className="text-xs text-muted-foreground italic">
          The menu is currently empty. Be the first to bring something!
        </p>
      ) : (
        <ul className="space-y-0.5">
          {grouped.map((g) => {
            const count = g.items.length;
            const dishList = count > 0 ? g.items.join(", ") : "Undecided";
            return (
              <li key={g.category} className="text-xs text-foreground leading-relaxed">
                <span className="font-semibold">{g.category}</span>
                {count > 0 && (
                  <span className="text-muted-foreground"> ({count})</span>
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
