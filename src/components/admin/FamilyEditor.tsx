import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  ArrowLeft, Users, Baby, CalendarCheck, Mail, Phone, Pencil, Trash2,
  Check, X, UserRound, UserPlus, Plus, Loader2, ChevronsUpDown, Move, Car, HeartHandshake,
} from "lucide-react";
import { cn } from "@/lib/utils";
import UserAvatar from "@/components/UserAvatar";
import { format } from "date-fns";
import EditUserModal from "./EditUserModal";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface Family { id: string; name: string }
interface MemberProfile {
  id: string; name: string | null; email: string | null;
  phone: string | null; avatar_url: string | null; family_id: string | null;
}
interface DependentRow {
  id: string;
  first_name: string;
  parent_id: string | null;
  family_id: string | null;
  type: string;
  type_other: string | null;
  date_of_birth: string | null;
  gender: string | null;
}

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

interface Props {
  family: Family;
  onBack: () => void;
  onDeleted: () => void;
}

export default function FamilyEditor({ family, onBack, onDeleted }: Props) {
  const qc = useQueryClient();
  const [isRenaming, setIsRenaming] = useState(false);
  const [editName, setEditName] = useState(family.name);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

  // Members in this family
  const { data: members = [], isLoading: loadingMembers } = useQuery<MemberProfile[]>({
    queryKey: ["family-editor-members", family.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, avatar_url, family_id")
        .eq("family_id", family.id)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const memberIds = members.map((m) => m.id);

  // Dependents (by family_id OR by parent_id of a member)
  const { data: dependents = [], isLoading: loadingDeps } = useQuery<DependentRow[]>({
    queryKey: ["family-editor-deps", family.id, memberIds.join(",")],
    queryFn: async () => {
      let query = supabase
        .from("dependents")
        .select("id, first_name, parent_id, family_id, type, date_of_birth, gender");
      if (memberIds.length > 0) {
        query = query.or(`family_id.eq.${family.id},parent_id.in.(${memberIds.join(",")})`);
      } else {
        query = query.eq("family_id", family.id);
      }
      const { data, error } = await query.order("first_name");
      if (error) throw error;
      return (data ?? []) as DependentRow[];
    },
  });

  // RSVPs for stats
  const { data: rsvps = [] } = useQuery({
    queryKey: ["family-editor-rsvps", memberIds.join(",")],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("id, event_id, user_id, checked_in, created_at, events(title, date_time)")
        .in("user_id", memberIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  // Other families (for move actions)
  const { data: allFamilies = [] } = useQuery<Family[]>({
    queryKey: ["admin-families"],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Unassigned profiles (to add to this family)
  const { data: unassigned = [] } = useQuery<MemberProfile[]>({
    queryKey: ["admin-unassigned-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, phone, avatar_url, family_id")
        .is("family_id", null)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["admin-families"] });
    qc.invalidateQueries({ queryKey: ["admin-profiles-for-families"] });
    qc.invalidateQueries({ queryKey: ["admin-unassigned-profiles"] });
    qc.invalidateQueries({ queryKey: ["family-editor-members", family.id] });
    qc.invalidateQueries({ queryKey: ["family-editor-deps", family.id] });
  };

  // ----- mutations -----
  const renameFamily = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase.from("families").update({ name }).eq("id", family.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Family renamed"); setIsRenaming(false); invalidateAll(); },
    onError: () => toast.error("Failed to rename family"),
  });

  const deleteFamily = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("profiles").update({ family_id: null }).eq("family_id", family.id);
      if (e1) throw e1;
      const { error } = await supabase.from("families").delete().eq("id", family.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Family deleted"); invalidateAll(); onDeleted(); },
    onError: (e: any) => toast.error(e?.message || "Failed to delete family"),
  });

  const setMemberFamily = useMutation({
    mutationFn: async ({ userId, familyId }: { userId: string; familyId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ family_id: familyId }).eq("id", userId);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(vars.familyId ? "Member moved" : "Member removed from family");
      invalidateAll();
    },
    onError: () => toast.error("Failed to update member"),
  });

  const deleteDependent = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("dependents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Removed"); invalidateAll(); },
    onError: () => toast.error("Failed to remove"),
  });

  const moveDependent = useMutation({
    mutationFn: async ({ id, familyId }: { id: string; familyId: string }) => {
      const { error } = await supabase
        .from("dependents")
        .update({ family_id: familyId, parent_id: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Moved"); invalidateAll(); },
    onError: () => toast.error("Failed to move"),
  });

  const upsertDependent = useMutation({
    mutationFn: async (d: Partial<DependentRow> & { id?: string }) => {
      if (d.id) {
        const { error } = await supabase
          .from("dependents")
          .update({
            first_name: d.first_name,
            type: d.type,
            gender: d.gender,
            date_of_birth: d.date_of_birth || null,
          })
          .eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("dependents").insert({
          family_id: family.id,
          first_name: d.first_name!,
          type: d.type!,
          gender: d.gender || null,
          date_of_birth: d.date_of_birth || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); invalidateAll(); setDepDialog(null); },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  // ----- stats -----
  const uniqueEventIds = new Set(rsvps.map((r: any) => r.event_id));
  const totalEvents = uniqueEventIds.size;
  const recentEvents = useMemo(() => {
    const seen = new Set<string>();
    const out: any[] = [];
    for (const r of rsvps as any[]) {
      if (seen.has(r.event_id)) continue;
      seen.add(r.event_id);
      if (r.events) out.push(r);
      if (out.length >= 5) break;
    }
    return out;
  }, [rsvps]);

  // ----- add member combobox -----
  const [memberPickOpen, setMemberPickOpen] = useState(false);
  // ----- dependent dialog -----
  const [depDialog, setDepDialog] = useState<null | Partial<DependentRow>>(null);

  const isLoading = loadingMembers || loadingDeps;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 -ml-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Users className="h-5 w-5 text-primary shrink-0" />
        {isRenaming ? (
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="h-9 text-base"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && editName.trim()) renameFamily.mutate(editName.trim());
                if (e.key === "Escape") { setIsRenaming(false); setEditName(family.name); }
              }}
            />
            <Button
              size="icon" variant="ghost" className="h-8 w-8"
              disabled={!editName.trim() || renameFamily.isPending}
              onClick={() => renameFamily.mutate(editName.trim())}
            >
              {renameFamily.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8"
              onClick={() => { setIsRenaming(false); setEditName(family.name); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-semibold flex-1 truncate">{family.name}</h2>
            <Button size="icon" variant="ghost" className="h-8 w-8"
              onClick={() => { setEditName(family.name); setIsRenaming(true); }}>
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {family.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Removes the family and unassigns {members.length} member{members.length !== 1 ? "s" : ""}.
                    Dependents assigned only to this family will be deleted. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => deleteFamily.mutate()}>
                    {deleteFamily.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4 text-center">
          <Users className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold">{members.length}</p>
          <p className="text-xs text-muted-foreground">Members</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <Baby className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold">{dependents.length}</p>
          <p className="text-xs text-muted-foreground">Dependents</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <CalendarCheck className="h-5 w-5 mx-auto mb-1 text-primary" />
          <p className="text-2xl font-bold">{totalEvents}</p>
          <p className="text-xs text-muted-foreground">Events RSVP'd</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Members */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Family Members</h3>
              <AddMemberPopover
                open={memberPickOpen}
                onOpenChange={setMemberPickOpen}
                unassigned={unassigned}
                onPick={(userId) => {
                  setMemberFamily.mutate({ userId, familyId: family.id });
                  setMemberPickOpen(false);
                }}
              />
            </div>
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members yet.</p>
            ) : (
              <div className="space-y-2">
                {members.map((m) => (
                  <div key={m.id} className="flex gap-3 items-start rounded-lg border p-3 text-sm">
                    <UserAvatar name={m.name} avatarUrl={m.avatar_url} className="h-10 w-10 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{m.name || "Unnamed"}</p>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        {m.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{m.email}</span>}
                        {m.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{m.phone}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        size="icon" variant="ghost" className="h-8 w-8"
                        title="Edit profile"
                        onClick={async () => {
                          const { data } = await supabase.from("profiles").select("*").eq("id", m.id).single();
                          if (data) setEditingProfile(data as Profile);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <MoveFamilyPopover
                        currentId={family.id}
                        families={allFamilies}
                        onMove={(fid) => setMemberFamily.mutate({ userId: m.id, familyId: fid })}
                      />
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Remove from family">
                            <X className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Remove {m.name || "this member"} from {family.name}?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The account stays — only the family link is cleared.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              onClick={() => setMemberFamily.mutate({ userId: m.id, familyId: null })}>
                              Remove
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Dependents & Household */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Dependents &amp; Household</h3>
              <Button size="sm" variant="outline" className="gap-1.5"
                onClick={() => setDepDialog({ type: "child", first_name: "" })}>
                <Plus className="h-4 w-4" /> Add
              </Button>
            </div>
            {dependents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No dependents or household members yet.</p>
            ) : (
              <div className="space-y-2">
                {dependents.map((d) => {
                  const meta = typeMeta(d.type);
                  const Icon = meta.icon;
                  return (
                    <div key={d.id} className="flex gap-3 items-center rounded-lg border p-3 text-sm">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{d.first_name}</p>
                        <div className="flex flex-wrap gap-2 mt-0.5">
                          <Badge variant="secondary" className="text-xs">{meta.label}</Badge>
                          {d.gender && <Badge variant="outline" className="text-xs capitalize">{d.gender}</Badge>}
                          {d.date_of_birth && (
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(d.date_of_birth), "MMM d, yyyy")}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Edit"
                          onClick={() => setDepDialog(d)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <MoveFamilyPopover
                          currentId={family.id}
                          families={allFamilies}
                          onMove={(fid) => moveDependent.mutate({ id: d.id, familyId: fid })}
                        />
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Delete">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete {d.first_name}?</AlertDialogTitle>
                              <AlertDialogDescription>This cannot be undone.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                onClick={() => deleteDependent.mutate(d.id)}>
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent activity */}
          {recentEvents.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <CalendarCheck className="h-4 w-4" /> Recent Activity
              </h3>
              <div className="space-y-2">
                {recentEvents.map((r: any) => (
                  <div key={r.event_id} className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className="font-medium truncate">{r.events?.title}</span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap ml-2">
                      {r.events?.date_time && format(new Date(r.events.date_time), "MMM d, yyyy")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <EditUserModal
        profile={editingProfile}
        open={!!editingProfile}
        onOpenChange={(o) => { if (!o) { setEditingProfile(null); invalidateAll(); } }}
      />

      <DependentDialog
        value={depDialog}
        onClose={() => setDepDialog(null)}
        onSave={(v) => upsertDependent.mutate(v)}
        saving={upsertDependent.isPending}
      />
    </div>
  );
}

// -------- subcomponents --------

function AddMemberPopover({
  open, onOpenChange, unassigned, onPick,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  unassigned: MemberProfile[];
  onPick: (userId: string) => void;
}) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-1.5">
          <UserPlus className="h-4 w-4" /> Add member
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0 z-[110] bg-popover" align="end">
        <Command>
          <CommandInput placeholder="Search unassigned members…" />
          <CommandList>
            <CommandEmpty>No unassigned members.</CommandEmpty>
            <CommandGroup>
              {unassigned.map((p) => (
                <CommandItem
                  key={p.id}
                  value={`${p.name || ""} ${p.email || ""}`}
                  onSelect={() => onPick(p.id)}
                >
                  <span className="truncate">
                    <span className="font-medium">{p.name || "Unnamed"}</span>
                    <span className="text-muted-foreground ml-1 text-xs">({p.email || "no email"})</span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function MoveFamilyPopover({
  currentId, families, onMove,
}: {
  currentId: string;
  families: Family[];
  onMove: (familyId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const others = families.filter((f) => f.id !== currentId);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="icon" variant="ghost" className="h-8 w-8" title="Move to another family">
          <Move className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0 z-[110] bg-popover" align="end">
        <Command>
          <CommandInput placeholder="Move to family…" />
          <CommandList>
            <CommandEmpty>No other families.</CommandEmpty>
            <CommandGroup>
              {others.map((f) => (
                <CommandItem key={f.id} value={f.name} onSelect={() => { onMove(f.id); setOpen(false); }}>
                  {f.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function DependentDialog({
  value, onClose, onSave, saving,
}: {
  value: Partial<DependentRow> | null;
  onClose: () => void;
  onSave: (v: Partial<DependentRow> & { id?: string }) => void;
  saving: boolean;
}) {
  const [first_name, setFirstName] = useState("");
  const [type, setType] = useState<string>("child");
  const [gender, setGender] = useState<string>("");
  const [dob, setDob] = useState<string>("");

  const open = !!value;
  const id = value?.id;

  useEffect(() => {
    if (!value) return;
    setFirstName(value.first_name ?? "");
    setType(value.type ?? "child");
    setGender(value.gender ?? "");
    setDob(value.date_of_birth ?? "");
  }, [value]);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{id ? "Edit" : "Add"} dependent / household</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="dep-name">Name</Label>
            <Input id="dep-name" value={first_name} onChange={(e) => setFirstName(e.target.value)} placeholder="First name" />
          </div>
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Gender</Label>
              <Select value={gender || "unspecified"} onValueChange={(v) => setGender(v === "unspecified" ? "" : v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="unspecified">—</SelectItem>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="dep-dob">Date of birth</Label>
              <Input id="dep-dob" type="date" value={dob ?? ""} onChange={(e) => setDob(e.target.value)} />
            </div>
          </div>
          <Button
            className="w-full"
            disabled={!first_name.trim() || saving}
            onClick={() => onSave({ id, first_name: first_name.trim(), type, gender, date_of_birth: dob || null })}
          >
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

