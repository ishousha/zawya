import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Copy, Loader2, MessageCircle, User, Plus, Pencil, Check, X, LogOut } from "lucide-react";
import { useState } from "react";
import { Input } from "@/components/ui/input";

export default function FamilyInviteSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const familyId = profile?.family_id ?? null;
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingName, setSavingName] = useState(false);

  // Fetch family name
  const { data: familyName } = useQuery({
    queryKey: ["my-family-name", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("name")
        .eq("id", familyId!)
        .single();
      if (error) throw error;
      return data?.name || "My Family";
    },
  });

  // Fetch family members
  const { data: familyMembers } = useQuery({
    queryKey: ["family-members-list", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email")
        .eq("family_id", familyId!);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch pending invites
  const { data: invites } = useQuery({
    queryKey: ["family-invites", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .select("*")
        .eq("family_id", familyId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const handleCreateFamily = async () => {
    if (!user || !profile) return;
    setCreating(true);

    // Derive a family name from the user's profile name
    const nameParts = (profile.name || "").trim().split(/\s+/);
    const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : nameParts[0] || "My";
    const familyLabel = `${lastName} Family`;

    // Create family record
    const { data: family, error: famErr } = await supabase
      .from("families")
      .insert({ name: familyLabel })
      .select("id")
      .single();

    if (famErr || !family) {
      toast.error("Failed to create family group.");
      setCreating(false);
      return;
    }

    // Link user to this family
    const { error: profErr } = await supabase
      .from("profiles")
      .update({ family_id: family.id })
      .eq("id", user.id);

    setCreating(false);

    if (profErr) {
      toast.error("Family created but failed to link your profile.");
      return;
    }

    toast.success(`"${familyLabel}" created!`);
    queryClient.invalidateQueries({ queryKey: ["my-family-name"] });
    queryClient.invalidateQueries({ queryKey: ["family-members-list"] });
    // Force profile refresh
    window.location.reload();
  };

  const handleSaveName = async () => {
    if (!familyId || !editName.trim()) return;
    setSavingName(true);
    const { error } = await supabase
      .from("families")
      .update({ name: editName.trim() })
      .eq("id", familyId);
    setSavingName(false);
    if (error) {
      toast.error("Failed to update family name.");
    } else {
      toast.success("Family name updated!");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["my-family-name", familyId] });
    }
  };

  const [leaving, setLeaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const handleLeaveFamily = async () => {
    if (!user || !familyId) return;
    setLeaving(true);

    // Capture family members and name before leaving
    const memberEmails = (familyMembers ?? [])
      .filter((m) => m.id !== user.id && m.email)
      .map((m) => ({ email: m.email!, name: m.name }));
    const fName = familyName || "your family group";
    const leaverName = profile?.name || "A member";

    const { error } = await supabase
      .from("profiles")
      .update({ family_id: null })
      .eq("id", user.id);

    setLeaving(false);

    if (error) {
      toast.error("Failed to leave family group.");
    } else {
      toast.success("You left the family group.");
      setConfirmLeave(false);

      // Send email notifications to remaining members (fire-and-forget)
      for (const member of memberEmails) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "family-member-left",
            to: member.email,
            data: {
              memberName: member.name || undefined,
              leaverName,
              familyName: fName,
            },
          },
        }).catch(() => {}); // best-effort
      }

      window.location.reload();
    }
  };

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .insert({
          family_id: familyId!,
          created_by: profile!.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["family-invites", familyId] });
      const url = `${window.location.origin}/join-family?token=${(data as any).token}`;
      navigator.clipboard.writeText(url).then(() => {
        toast.success("Invite link copied to clipboard!");
      }).catch(() => {
        toast.success("Invite created! Copy the link below.");
      });
    },
    onError: () => toast.error("Failed to create invite"),
  });

  const shareViaWhatsApp = (url: string) => {
    const text = encodeURIComponent(
      `You're invited to join our family on Zawya! Tap the link to accept:\n${url}`
    );
    window.open(`https://wa.me/?text=${text}`, "_blank");
  };

  if (!familyId) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            Family Group
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-3">
          <p className="text-sm text-muted-foreground">
            Create a family group to manage RSVPs and invite family members.
          </p>
          <Button
            className="w-full gap-1.5"
            onClick={handleCreateFamily}
            disabled={creating}
          >
            {creating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Create Family Group
          </Button>
        </CardContent>
      </Card>
    );
  }

  const pendingInvites = invites?.filter((i) => (i as any).status === "pending") ?? [];

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          {editing ? (
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="h-7 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSaveName();
                  if (e.key === "Escape") setEditing(false);
                }}
              />
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={handleSaveName}
                disabled={savingName || !editName.trim()}
              >
                {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0"
                onClick={() => setEditing(false)}
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <>
              <span className="truncate">{familyName || "My Family"}</span>
              <button
                onClick={() => { setEditName(familyName || ""); setEditing(true); }}
                className="ml-1 text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Edit family name"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current family members */}
        {familyMembers && familyMembers.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Family Members</p>
            <div className="space-y-1.5">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border p-2.5"
                >
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">
                      {member.name || "Unnamed"}
                      {member.id === user?.id && (
                        <span className="ml-1 text-xs text-muted-foreground">(You)</span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invite button */}
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UserPlus className="h-4 w-4" />
          )}
          Invite Family Member
        </Button>

        {/* Pending invites with share options */}
        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pending Invites</p>
            {pendingInvites.map((inv) => {
              const url = `${window.location.origin}/join-family?token=${(inv as any).token}`;
              return (
                <div
                  key={(inv as any).id}
                  className="rounded-lg border border-border p-3 space-y-2"
                >
                  <p className="text-xs text-muted-foreground font-mono truncate">{url}</p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast.success("Link copied!");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" />
                      Copy Link
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1 gap-1.5 text-xs"
                      onClick={() => shareViaWhatsApp(url)}
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      WhatsApp
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Leave family */}
        {!confirmLeave ? (
          <button
            onClick={() => setConfirmLeave(true)}
            className="w-full text-center text-xs text-muted-foreground hover:text-destructive transition-colors mt-2"
          >
            Leave family group
          </button>
        ) : (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 space-y-2 mt-2">
            <p className="text-sm text-destructive font-medium text-center">Leave this family group?</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmLeave(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1 gap-1.5"
                onClick={handleLeaveFamily}
                disabled={leaving}
              >
                {leaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                Leave
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
