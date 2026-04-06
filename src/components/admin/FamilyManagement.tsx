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
import { Plus, Users, UserPlus, X, Loader2, Check, ChevronsUpDown, Search, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import FamilyDetailsModal from "./FamilyDetailsModal";

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
  const [familySearch, setFamilySearch] = useState("");
  const [memberComboOpen, setMemberComboOpen] = useState(false);
  const [tableSearch, setTableSearch] = useState("");

  const unassignedMembers = useMemo(
    () => profiles?.filter((p) => !p.family_id) ?? [],
    [profiles]
  );

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-families"] });
    queryClient.invalidateQueries({ queryKey: ["admin-profiles-for-families"] });
  };

  const createFamily = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("families").insert({ name }).select().single();
      if (error) throw error;
      return data as Family;
    },
    onSuccess: (data, _vars, _ctx) => {
      toast.success("Family created");
      setNewFamilyName("");
      setCreateOpen(false);
      invalidate();
      return data;
    },
    onError: () => toast.error("Failed to create family"),
  });

  const createAndSelectFamily = useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await supabase.from("families").insert({ name }).select().single();
      if (error) throw error;
      return data as Family;
    },
    onSuccess: (data) => {
      toast.success(`"${data.name}" family created`);
      setAssignFamilyId(data.id);
      setFamilyComboOpen(false);
      setFamilySearch("");
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
    profiles?.filter((p) => p.family_id === familyId) ?? [];

  const filteredFamilies = useMemo(() => {
    if (!families) return [];
    if (!tableSearch.trim()) return families;
    const q = tableSearch.toLowerCase();
    return families.filter((f) => f.name.toLowerCase().includes(q));
  }, [families, tableSearch]);

  // Check if the family search term matches an existing family (for inline creation)
  const familySearchTrimmed = familySearch.trim();
  const familySearchExists = families?.some(
    (f) => f.name.toLowerCase() === familySearchTrimmed.toLowerCase()
  );

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

        <Dialog open={assignOpen} onOpenChange={(open) => {
          setAssignOpen(open);
          if (!open) {
            setAssignFamilyId("");
            setAssignUserId("");
            setFamilySearch("");
          }
        }}>
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
              {/* Family combobox */}
              <div>
                <Label>Family</Label>
                <Popover open={familyComboOpen} onOpenChange={setFamilyComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={familyComboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {assignFamilyId
                        ? families?.find((f) => f.id === assignFamilyId)?.name
                        : "Search families…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Search families…"
                        value={familySearch}
                        onValueChange={setFamilySearch}
                      />
                      <CommandList>
                        <CommandEmpty>
                          <span className="text-muted-foreground text-sm">No family found.</span>
                        </CommandEmpty>
                        <CommandGroup>
                          {families?.map((f) => (
                            <CommandItem
                              key={f.id}
                              value={f.name}
                              onSelect={() => {
                                setAssignFamilyId(f.id);
                                setFamilyComboOpen(false);
                                setFamilySearch("");
                              }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", assignFamilyId === f.id ? "opacity-100" : "opacity-0")} />
                              {f.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                        {/* Inline create option */}
                        {familySearchTrimmed && !familySearchExists && (
                          <CommandGroup>
                            <CommandItem
                              value={`__create__${familySearchTrimmed}`}
                              onSelect={() => {
                                createAndSelectFamily.mutate(familySearchTrimmed);
                              }}
                              className="text-primary"
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Create "{familySearchTrimmed}" Family
                            </CommandItem>
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Member combobox */}
              <div>
                <Label>Member (unassigned only)</Label>
                <Popover open={memberComboOpen} onOpenChange={setMemberComboOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={memberComboOpen}
                      className="w-full justify-between font-normal"
                    >
                      {assignUserId
                        ? (() => {
                            const m = unassignedMembers.find((p) => p.id === assignUserId);
                            return m ? `${m.name || "Unnamed"} (${m.email || "no email"})` : "Select member";
                          })()
                        : "Search members…"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search by name or email…" />
                      <CommandList>
                        <CommandEmpty>No unassigned members found.</CommandEmpty>
                        <CommandGroup>
                          {unassignedMembers.map((p) => {
                            const displayName = p.name || "Unnamed";
                            const displayEmail = p.email || "no email";
                            const label = `${displayName} (${displayEmail})`;
                            return (
                              <CommandItem
                                key={p.id}
                                value={`${p.name || ""} ${p.email || ""}`}
                                onSelect={() => {
                                  setAssignUserId(p.id);
                                  setMemberComboOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", assignUserId === p.id ? "opacity-100" : "opacity-0")} />
                                <span className="truncate">
                                  <span className="font-medium">{displayName}</span>
                                  <span className="text-muted-foreground ml-1">({displayEmail})</span>
                                </span>
                              </CommandItem>
                            );
                          })}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
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

      {/* Search bar for families table */}
      <div className="relative">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search families…"
          value={tableSearch}
          onChange={(e) => setTableSearch(e.target.value)}
          className="pl-9 h-9"
        />
      </div>

      {/* Family cards */}
      {filteredFamilies.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Users className="mx-auto h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">
            {tableSearch.trim()
              ? "No families match your search."
              : "No families yet. Create one to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFamilies.map((family) => {
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
