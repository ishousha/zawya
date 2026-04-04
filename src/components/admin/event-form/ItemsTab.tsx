import { PackagePlus } from "lucide-react";

export default function ItemsTab() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <PackagePlus className="h-12 w-12 text-muted-foreground/50 mb-3" />
      <h3 className="font-heading text-lg font-semibold text-foreground">
        Sign-Up Items
      </h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Add flexible sign-up items (food, supplies, volunteers) that members can claim when they RSVP.
      </p>
      <p className="text-xs text-muted-foreground/70 mt-4 italic">
        Coming in the next step
      </p>
    </div>
  );
}
