import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { User, Users } from "lucide-react";
import type { FamilyMember } from "@/hooks/useFamilyMembers";
import type { Database } from "@/integrations/supabase/types";

type Dependent = Database["public"]["Tables"]["dependents"]["Row"];

interface AttendeeChecklistProps {
  familyMembers: FamilyMember[];
  selectedMemberIds: Set<string>;
  onToggleMember: (id: string) => void;
  dependents: Dependent[];
  selectedDependentIds: Set<string>;
  onToggleDependent: (id: string) => void;
}

export default function AttendeeChecklist({
  familyMembers,
  selectedMemberIds,
  onToggleMember,
  dependents,
  selectedDependentIds,
  onToggleDependent,
}: AttendeeChecklistProps) {
  const hasFamily = familyMembers.length > 1;

  return (
    <div className="space-y-3">
      <Label className="block text-sm font-medium flex items-center gap-2">
        {hasFamily && <Users className="h-4 w-4 text-primary" />}
        Who is attending?
      </Label>

      <div className="space-y-2">
        {/* Family members */}
        {familyMembers.map((member) => (
          <label
            key={member.id}
            className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
          >
            <Checkbox
              checked={selectedMemberIds.has(member.id)}
              onCheckedChange={() => onToggleMember(member.id)}
            />
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">
                {member.name || "Unknown"}
                {member.isSelf && (
                  <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                )}
              </span>
            </div>
          </label>
        ))}

        {/* Dependents (children) */}
        {dependents.length > 0 && (
          <>
            <p className="text-xs text-muted-foreground pt-1">Children / Dependents</p>
            {dependents.map((dep) => (
              <label
                key={dep.id}
                className="flex items-center gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30"
              >
                <Checkbox
                  checked={selectedDependentIds.has(dep.id)}
                  onCheckedChange={() => onToggleDependent(dep.id)}
                />
                <span className="text-sm text-foreground">{dep.first_name}</span>
              </label>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
