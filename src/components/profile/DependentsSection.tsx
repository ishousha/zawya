import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Loader2, Baby, UserRound, Users, Car, HeartHandshake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { GenderToggle } from "@/pages/CompleteProfile";
import { format } from "date-fns";

const TYPE_OPTIONS = [
  { value: "son", label: "Son", icon: Baby },
  { value: "daughter", label: "Daughter", icon: Baby },
  { value: "father", label: "Father", icon: UserRound },
  { value: "mother", label: "Mother", icon: UserRound },
  { value: "maid", label: "Maid", icon: HeartHandshake },
  { value: "nanny", label: "Nanny", icon: HeartHandshake },
  { value: "driver", label: "Driver", icon: Car },
  { value: "househelper", label: "House Helper", icon: HeartHandshake },
  { value: "other", label: "Other (please specify)", icon: Users },
] as const;

const LEGACY_TYPE_LABELS: Record<string, string> = {
  child: "Child",
  elder: "Elder",
  helper: "House Helper",
};

function typeMeta(t: string) {
  return (
    TYPE_OPTIONS.find((o) => o.value === t) ??
    { value: t, label: LEGACY_TYPE_LABELS[t] ?? "Other", icon: Users }
  );
}

export function useDependents() {
  const { user, profile } = useAuth();
  const familyId = profile?.family_id as string | null;
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
  const [depType, setDepType] = useState<string>("son");
  const [typeOther, setTypeOther] = useState("");
  const [gender, setGender] = useState("");
  const [dob, setDob] = useState<string>("");

  const isOther = depType === "other";

  const resetForm = () => {
    setAdding(false);
    setFirstName("");
    setDepType("son");
    setTypeOther("");
    setGender("");
    setDob("");
  };

  const addDependent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const familyId = profile?.family_id as string | null;
      const { error } = await supabase.from("dependents").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        type: depType,
        type_other: isOther ? typeOther.trim() || null : null,
        family_id: familyId,
        gender: gender || null,
        date_of_birth: dob || null,
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

  const canSave =
    !!firstName.trim() && (!isOther || !!typeOther.trim()) && !addDependent.isPending;

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-card-foreground">
          Dependents & Household
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : dependents && dependents.length > 0 ? (
        <div className="space-y-2">
          {dependents.map((dep: any) => {
            const meta = typeMeta(dep.type || "other");
            const Icon = meta.icon;
            const label = dep.type === "other" && dep.type_other ? dep.type_other : meta.label;
            return (
              <div key={dep.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-card-foreground">{dep.first_name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{label}</Badge>
                      {dep.gender && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                          {dep.gender}
                        </Badge>
                      )}
                      {dep.date_of_birth && (
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(dep.date_of_birth), "MMM d, yyyy")}
                        </span>
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
            <Label className="text-sm font-medium">First Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="First name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">Type <span className="text-destructive">*</span></Label>
            <Select value={depType} onValueChange={setDepType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[110] bg-popover">
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {isOther && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Please specify <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="e.g. Cousin, Uncle, Friend"
                value={typeOther}
                onChange={(e) => setTypeOther(e.target.value)}
              />
            </div>
          )}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Gender</Label>
            <GenderToggle value={gender} onChange={setGender} />
          </div>
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Date of birth <span className="text-muted-foreground text-xs">(optional)</span>
            </Label>
            <Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addDependent.mutate()}
              disabled={!canSave}
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
