import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, Users, UserPlus, X, Loader2, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface Family {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  name: string | null;
  email: string | null;
  family_id: string | null;
}

function useFamilies() {
  return useQuery<Family[]>({
    queryKey: ["admin-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

function useAllProfiles() {
  return useQuery<Profile[]>({
    queryKey: ["admin-profiles-for-families"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, family_id")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function FamilyManagement() {
  const queryClient = useQueryClient();
  const { data: families, isLoading: loadingFamilies } = useFamilies();
  const { data: profiles, isLoading: loadingProfiles } = useAllProfiles();

  const [newFamilyName, setNewFamilyName] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignFamilyId, setAssignFamilyId] = useState("");
  const [assignUserId, setAssignUserId] = useState("");
  const [familyComboOpen, setFamilyComboOpen] = useState(false);
  const [memberComboOpen, setMemberComboOpen] = useState(false);

  const unassignedMembers = useMemo(
    () => profiles?.filter((p) => !(p as any).family_id) ?? [],
    [profiles]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-families"] });
    queryClient.invalidateQueries({ queryKey: ["admin-profiles-for-families"] });
  };

  const createFamily = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("families").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family created");
      setNewFamilyName("");
      setCreateOpen(false);
      invalidate();
    },
    onError: () => toast.error("Failed to create family"),
  });

  const assignMember = useMutation({
    mutationFn: async ({ userId, familyId }: { userId: string; familyId: string }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ family_id: familyId } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member assigned to family");
      setAssignUserId("");
      setAssignFamilyId("");
      setAssignOpen(false);
      invalidate();
    },
    onError: () => toast.error("Failed to assign member"),
  });

  const removeMember = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ family_id: null } as any)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed from family");
      invalidate();
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const getMembersOfFamily = (familyId: string) =>
    profiles?.filter((p) => (p as any).family_id === familyId) ?? [];

  const unassignedMembers =
    profiles?.filter((p) => !(p as any).family_id) ?? [];

  if (loadingFamilies || loadingProfiles) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Actions row */}
      <div className="flex flex-wrap gap-2">
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5">
              <Plus className="h-4 w-4" /> New Family
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Create Family</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label htmlFor="family-name">Family Name</Label>
                <Input
                  id="family-name"
                  placeholder="e.g. Al-Rashid Family"
                  value={newFamilyName}
                  onChange={(e) => setNewFamilyName(e.target.value)}
                />
              </div>
              <Button
                className="w-full"
                disabled={!newFamilyName.trim() || createFamily.isPending}
                onClick={() => createFamily.mutate(newFamilyName.trim())}
              >
                {createFamily.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="gap-1.5">
              <UserPlus className="h-4 w-4" /> Assign Member
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Assign Member to Family</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <Label>Family</Label>
                <Select value={assignFamilyId} onValueChange={setAssignFamilyId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select family" />
                  </SelectTrigger>
                  <SelectContent>
                    {families?.map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Member</Label>
                <Select value={assignUserId} onValueChange={setAssignUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select member" />
                  </SelectTrigger>
                  <SelectContent>
                    {profiles?.map((p) => {
                      const currentFamily = families?.find((f) => f.id === (p as any).family_id);
                      return (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name || p.email || p.id.slice(0, 8)}
                          {currentFamily && (
                            <span className="text-muted-foreground"> — {currentFamily.name}</span>
                          )}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                disabled={!assignFamilyId || !assignUserId || assignMember.isPending}
                onClick={() =>
                  assignMember.mutate({ userId: assignUserId, familyId: assignFamilyId })
                }
              >
                {assignMember.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Assign
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Family cards */}
      {(!families || families.length === 0) ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No families yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {families.map((family) => {
            const members = getMembersOfFamily(family.id);
            return (
              <Card key={family.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    {family.name}
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {members.length} {members.length === 1 ? "member" : "members"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {members.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No members assigned yet.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {members.map((m) => (
                        <Badge
                          key={m.id}
                          variant="outline"
                          className="gap-1 pr-1"
                        >
                          {m.name || m.email || "Unknown"}
                          <button
                            onClick={() => removeMember.mutate(m.id)}
                            className="ml-1 rounded-full p-0.5 hover:bg-destructive/20"
                            title="Remove from family"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
