import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Baby, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { GenderToggle } from "@/pages/CompleteProfile";

const AGE_GROUPS = [
  { value: "infant_0_3", label: "Infant (0-3)" },
  { value: "child_4_12", label: "Child (4-12)" },
  { value: "youth_13_17", label: "Youth (13-17)" },
  { value: "adult_18_plus", label: "Adult (18+)" },
];

const AGE_GROUP_LABELS: Record<string, string> = {
  infant_0_3: "Infant (0-3)",
  child_4_12: "Child (4-12)",
  youth_13_17: "Youth (13-17)",
  adult_18_plus: "Adult (18+)",
};

export function useDependents() {
  const { user, profile } = useAuth();
  const familyId = (profile as any)?.family_id as string | null;
  return useQuery({
    queryKey: ["dependents", user?.id, familyId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("dependents")
        .select("*")
        .order("created_at", { ascending: true });

      if (familyId) {
        (query as any) = query.eq("family_id", familyId);
      } else {
        query = query.eq("parent_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export default function DependentsSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const { data: dependents, isLoading } = useDependents();
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [depType, setDepType] = useState<"child" | "elder">("child");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState<string | undefined>(undefined);

  const resetForm = () => {
    setAdding(false);
    setFirstName("");
    setDepType("child");
    setGender("");
    setAgeGroup(undefined);
  };

  const addDependent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const familyId = (profile as any)?.family_id as string | null;
      const { error } = await supabase.from("dependents").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        type: depType,
        family_id: familyId,
        gender: gender || null,
        age_group: ageGroup || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents", user?.id] });
      toast.success("Dependent added successfully.");
      resetForm();
    },
    onError: () => toast.error("Failed to add dependent."),
  });

  const removeDependent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents", user?.id] });
      toast.success("Dependent removed.");
    },
    onError: () => toast.error("Failed to remove dependent."),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-card-foreground">
          Dependents (Children & Elders)
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Dependent
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : dependents && dependents.length > 0 ? (
        <div className="space-y-2">
          {dependents.map((dep) => {
            const type = dep.type || "child";
            const depGender = dep.gender;
            const depAgeGroup = dep.age_group;
            return (
              <div key={dep.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  {type === "elder" ? (
                    <UserRound className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Baby className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{dep.first_name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {type === "elder" ? "Elder/Adult" : "Child"}
                      </Badge>
                      {depGender && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {depGender === "male" ? "♂ Male" : "♀ Female"}
                        </Badge>
                      )}
                      {depAgeGroup && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {AGE_GROUP_LABELS[depAgeGroup] || depAgeGroup}
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive"
                  onClick={() => removeDependent.mutate(dep.id)}
                  disabled={removeDependent.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No dependents added yet.</p>
      )}

      {adding && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Dependent Type <span className="text-destructive">*</span></Label>
            <Select value={depType} onValueChange={(v) => setDepType(v as "child" | "elder")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="child">Child</SelectItem>
                <SelectItem value="elder">Elder/Adult</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">First Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder={depType === "elder" ? "Elder's first name" : "Child's first name"}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gender</Label>
            <GenderToggle value={gender} onChange={setGender} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Age Group</Label>
            <Select value={ageGroup} onValueChange={(v) => setAgeGroup(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Select age group" />
              </SelectTrigger>
              <SelectContent>
                {AGE_GROUPS.map((ag) => (
                  <SelectItem key={ag.value} value={ag.value}>
                    {ag.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addDependent.mutate()}
              disabled={!firstName.trim() || addDependent.isPending}
            >
              {addDependent.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={resetForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
