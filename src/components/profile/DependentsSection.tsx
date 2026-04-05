import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Trash2, Loader2 } from "lucide-react";
import { format, parse } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function useDependents() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["dependents", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("dependents")
        .select("*")
        .eq("parent_id", user!.id)
        .order("created_at", { ascending: true });
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
  const [dob, setDob] = useState<Date | undefined>(undefined);

  const addChild = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("dependents").insert({
        parent_id: user.id,
        first_name: firstName.trim(),
        date_of_birth: dob ? format(dob, "yyyy-MM-dd") : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents", user?.id] });
      toast.success("Child added successfully.");
      setAdding(false);
      setFirstName("");
      setDob(undefined);
    },
    onError: () => toast.error("Failed to add child."),
  });

  const removeChild = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dependents", user?.id] });
      toast.success("Child removed.");
    },
    onError: () => toast.error("Failed to remove child."),
  });

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg font-semibold text-card-foreground">
          My Dependents (Children)
        </h3>
        {!adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)} className="gap-1">
            <Plus className="h-4 w-4" /> Add Child
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : dependents && dependents.length > 0 ? (
        <div className="space-y-2">
          {dependents.map((child) => (
            <div key={child.id} className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium text-card-foreground">{child.first_name}</p>
                {child.date_of_birth && (
                  <p className="text-xs text-muted-foreground">
                    DOB: {format(parse(child.date_of_birth, "yyyy-MM-dd", new Date()), "PPP")}
                  </p>
                )}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive"
                onClick={() => removeChild.mutate(child.id)}
                disabled={removeChild.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">No children added yet.</p>
      )}

      {adding && (
        <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">First Name <span className="text-destructive">*</span></Label>
            <Input
              placeholder="Child's first name"
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
                  fromYear={2000}
                  toYear={new Date().getFullYear()}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => addChild.mutate()}
              disabled={!firstName.trim() || addChild.isPending}
            >
              {addChild.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setAdding(false); setFirstName(""); setDob(undefined); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
