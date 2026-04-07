import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Plus, Trash2, Loader2, Baby, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

      // If user has a family, get all family dependents; otherwise get their own
      if (familyId) {
        query = query.eq("family_id" as any, familyId);
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data: dependents, isLoading } = useDependents();
  const [adding, setAdding] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [depType, setDepType] = useState<"child" | "elder">("child");
  const [dob, setDob] = useState<Date | undefined>(undefined);

  const addDependent = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const familyId = (profile as any)?.family_id as string | null;
      const { error } = await supabase.from("dependents").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        date_of_birth: dob ? format(dob, "yyyy-MM-dd") : null,
        type: depType,
        family_id: familyId,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents", user?.id] });
      toast.success("Dependent added successfully.");
      setAdding(false);
      setFirstName("");
      setDepType("child");
      setDob(undefined);
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
            const type = (dep as any).type || "child";
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
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {type === "elder" ? "Elder/Adult" : "Child"}
                      </Badge>
                      {dep.date_of_birth && (
                        <p className="text-xs text-muted-foreground">
                          DOB: {format(parse(dep.date_of_birth, "yyyy-MM-dd", new Date()), "PPP")}
                        </p>
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
            <Label className="text-sm font-medium">Date of Birth</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !dob && "text-muted-foreground")}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dob ? format(dob, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={dob}
                  onSelect={setDob}
                  disabled={(date) => date > new Date() || date < new Date("1900-01-01")}
                  initialFocus
                  captionLayout="dropdown-buttons"
                  fromYear={1920}
                  toYear={new Date().getFullYear()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
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
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setFirstName(""); setDob(undefined); setDepType("child"); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
