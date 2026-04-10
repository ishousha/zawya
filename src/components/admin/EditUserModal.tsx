import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { GenderToggle } from "@/pages/CompleteProfile";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type AppRole = Database["public"]["Enums"]["app_role"];

interface EditUserModalProps {
  profile: Profile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function getErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof (error as { message?: unknown }).message === "string") {
    return (error as { message: string }).message;
  }
  return fallback;
}

export default function EditUserModal({ profile, open, onOpenChange }: EditUserModalProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [gender, setGender] = useState("");
  const [role, setRole] = useState<AppRole>("approved");
  const [isMureed, setIsMureed] = useState(false);
  const [selectedFamilyId, setSelectedFamilyId] = useState<string | null>(null);

  const { data: families = [] } = useQuery({
    queryKey: ["admin-families"],
    queryFn: async () => {
      const { data, error } = await supabase.from("families").select("id, name").order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!profile || !open) return;
    setName(profile.name || "");
    setPhone(profile.phone || "");
    setFamilyName(profile.family_name || "");
    setGender((profile as any).gender || "");
    setRole(profile.role);
    setIsMureed((profile as any).is_mureed ?? false);
    setSelectedFamilyId(profile.family_id || null);
  }, [profile, open]);

  const updateUser = useMutation({
    mutationFn: async () => {
      if (!profile) throw new Error("No user selected");

      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          name,
          phone,
          family_name: familyName || null,
          gender: gender || null,
          role,
          is_mureed: isMureed,
          family_id: selectedFamilyId,
        } as any)
        .eq("id", profile.id);
      if (profileError) throw profileError;

      const { error: deleteRolesError } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", profile.id);
      if (deleteRolesError) throw deleteRolesError;

      const { error: upsertRoleError } = await supabase
        .from("user_roles")
        .upsert({ user_id: profile.id, role }, { onConflict: "user_id,role" });
      if (upsertRoleError) throw upsertRoleError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
      toast.success("User updated successfully");
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err, "Failed to update user")),
    onSettled: () => {},
  });

  if (!profile) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit User</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile.email || ""} disabled className="opacity-60" />
            <p className="text-xs text-muted-foreground">Email cannot be changed</p>
          </div>
          <div className="space-y-2">
            <Label>Phone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1234567890" />
          </div>
          <div className="space-y-2">
            <Label>Family Name</Label>
            <Input value={familyName} onChange={(e) => setFamilyName(e.target.value)} placeholder="e.g. Hassan" />
          </div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <GenderToggle value={gender} onChange={setGender} />
          </div>
          <div className="space-y-2">
            <Label>Family Group</Label>
            <Select
              value={selectedFamilyId || "none"}
              onValueChange={(v) => setSelectedFamilyId(v === "none" ? null : v)}
            >
              <SelectTrigger><SelectValue placeholder="No family" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No family</SelectItem>
                {families.map((f) => (
                  <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="guest">Guest</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Mureed Status</Label>
            <Switch checked={isMureed} onCheckedChange={setIsMureed} />
          </div>
          <Button className="w-full" onClick={() => updateUser.mutate()} disabled={updateUser.isPending}>
            {updateUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
