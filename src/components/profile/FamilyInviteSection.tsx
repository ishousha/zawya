import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Users, Link as LinkIcon, Copy, Loader2 } from "lucide-react";

export default function FamilyInviteSection() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const familyId = (profile as any)?.family_id as string | null;

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
      <CardContent className="space-y-3">
        <Button
          size="sm"
          className="w-full gap-1.5"
          onClick={() => createInvite.mutate()}
          disabled={createInvite.isPending}
        >
          {createInvite.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LinkIcon className="h-4 w-4" />
          )}
          Generate Invite Link
        </Button>

        {pendingInvites.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Pending invites</p>
            {pendingInvites.map((inv) => {
              const url = `${window.location.origin}/join-family?token=${(inv as any).token}`;
              return (
                <div
                  key={(inv as any).id}
                  className="flex items-center gap-2 rounded-lg border border-border p-2 text-xs"
                >
                  <span className="truncate flex-1 text-muted-foreground font-mono">{url}</span>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(url);
                      toast.success("Link copied!");
                    }}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
