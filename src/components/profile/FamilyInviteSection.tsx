import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, UserPlus, Copy, Loader2, MessageCircle, User } from "lucide-react";

export default function FamilyInviteSection() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const familyId = (profile as any)?.family_id as string | null;

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

  const createInvite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .insert({
          family_id: familyId!,
          created_by: profile!.id,
        } as any)
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
        <CardContent className="p-4 text-center">
          <Users className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-40" />
          <p className="text-sm text-muted-foreground">
            You're not part of a family group yet. Ask an admin to assign you.
          </p>
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
          {familyName || "My Family"}
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
      </CardContent>
    </Card>
  );
}
