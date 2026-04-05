import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { User } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Dependent = Database["public"]["Tables"]["dependents"]["Row"];

interface AttendeeChecklistProps {
  userName: string;
  dependents: Dependent[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  selfChecked: boolean;
  onSelfToggle: () => void;
}

export default function AttendeeChecklist({
  userName,
  dependents,
  selectedIds,
  onToggle,
  selfChecked,
  onSelfToggle,
}: AttendeeChecklistProps) {
  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium">Who is attending?</Label>
      <div className="space-y-2">
        {/* Self */}
        <label className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30">
          <Checkbox checked={selfChecked} onCheckedChange={onSelfToggle} />
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">{userName || "Me"}</span>
          </div>
        </label>

        {/* Dependents */}
        {dependents.map((dep) => (
          <label
            key={dep.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
          >
            <Checkbox
              checked={selectedIds.has(dep.id)}
              onCheckedChange={() => onToggle(dep.id)}
            />
            <span className="text-sm text-foreground">{dep.first_name}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
