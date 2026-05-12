import { useState, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { toast } from "sonner";
import { Plus, Users, UserPlus, X, Loader2, Check, ChevronsUpDown, Search, Eye, Pencil, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import FamilyDetailsModal from "./FamilyDetailsModal";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
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
  const [detailFamily, setDetailFamily] = useState<Family | null>(null);
  const [editFamily, setEditFamily] = useState<Family | null>(null);
  const [editName, setEditName] = useState("");
  const [deleteFamily, setDeleteFamily] = useState<Family | null>(null);

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
        .update({ family_id: familyId })
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
        .update({ family_id: null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Member removed from family");
      invalidate();
    },
    onError: () => toast.error("Failed to remove member"),
  });

  const renameFamily = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from("families").update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family renamed");
      setEditFamily(null);
      setEditName("");
      invalidate();
    },
    onError: () => toast.error("Failed to rename family"),
  });

  const deleteFamilyMutation = useMutation({
    mutationFn: async (id: string) => {
      // Unassign all members first to satisfy FK
      const { error: unassignErr } = await supabase
        .from("profiles")
        .update({ family_id: null })
        .eq("family_id", id);
      if (unassignErr) throw unassignErr;
      const { error } = await supabase.from("families").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Family deleted");
      setDeleteFamily(null);
      invalidate();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete family"),
  });

  const getMembersOfFamily = (familyId: string) =>
    profiles?.filter((p) => p.family_id === familyId) ?? [];

  const debouncedTableSearch = useDebounce(tableSearch, 300);

  const filteredFamilies = useMemo(() => {
    if (!families) return [];
    if (!debouncedTableSearch.trim()) return families;
    const q = debouncedTableSearch.toLowerCase();
    return families.filter((f) => f.name.toLowerCase().includes(q));
  }, [families, debouncedTableSearch]);

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
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 gap-1 text-xs"
                      onClick={() => setDetailFamily(family)}
                    >
                      <Eye className="h-3.5 w-3.5" /> Details
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0"
                      title="Rename family"
                      onClick={() => { setEditFamily(family); setEditName(family.name); }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      title="Delete family"
                      onClick={() => setDeleteFamily(family)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
      {detailFamily && (
        <FamilyDetailsModal
          familyId={detailFamily.id}
          familyName={detailFamily.name}
          open={!!detailFamily}
          onOpenChange={(open) => { if (!open) setDetailFamily(null); }}
        />
      )}

      {/* Rename family dialog */}
      <Dialog open={!!editFamily} onOpenChange={(open) => { if (!open) { setEditFamily(null); setEditName(""); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Family</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label htmlFor="edit-family-name">Family Name</Label>
              <Input
                id="edit-family-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Family name"
              />
            </div>
            <Button
              className="w-full"
              disabled={!editName.trim() || editName.trim() === editFamily?.name || renameFamily.isPending}
              onClick={() => editFamily && renameFamily.mutate({ id: editFamily.id, name: editName.trim() })}
            >
              {renameFamily.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete family confirmation */}
      <AlertDialog open={!!deleteFamily} onOpenChange={(open) => { if (!open) setDeleteFamily(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteFamily?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteFamily && (() => {
                const count = getMembersOfFamily(deleteFamily.id).length;
                return count > 0
                  ? `This family has ${count} ${count === 1 ? "member" : "members"}. They will be unassigned (not deleted) and the family will be removed. This action cannot be undone.`
                  : "This family has no members. It will be permanently removed. This action cannot be undone.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteFamilyMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteFamilyMutation.isPending}
              onClick={(e) => {
                e.preventDefault();
                if (deleteFamily) deleteFamilyMutation.mutate(deleteFamily.id);
              }}
            >
              {deleteFamilyMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Family
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
