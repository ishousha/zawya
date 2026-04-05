import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, UserCheck, Clock } from "lucide-react";
import { toast } from "sonner";
import { notifyUserApproval } from "@/lib/webhooks";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type GuestRequest = Database["public"]["Tables"]["guest_requests"]["Row"];

export default function UserManagement() {
  const queryClient = useQueryClient();

  const { data: profiles, isLoading: loadingProfiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Sort: pending first
      return (data ?? []).sort((a, b) => {
        if (a.role === "pending" && b.role !== "pending") return -1;
        if (a.role !== "pending" && b.role === "pending") return 1;
        return 0;
      });
    },
  });

  const { data: guestRequests, isLoading: loadingGuests } = useQuery({
    queryKey: ["admin-guest-requests"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("guest_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      // Sort: pending first
      return (data ?? []).sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return 0;
      });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: Database["public"]["Enums"]["app_role"] }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ role })
        .eq("id", userId);
      if (error) throw error;
      notifyUserApproval(userId, role);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
      toast.success("User role updated");
    },
    onError: () => toast.error("Failed to update user role"),
  });

  const updateGuestStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("guest_requests")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guest-requests"] });
      toast.success("Guest request updated");
    },
    onError: () => toast.error("Failed to update guest request"),
  });

  if (loadingProfiles || loadingGuests) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 py-4">
      {/* Users Section */}
      <div>
        <h3 className="mb-3 font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" />
          Members ({profiles?.length ?? 0})
        </h3>
        <div className="space-y-2">
          {profiles?.map((p) => (
            <Card key={p.id} className={p.role === "pending" ? "border-accent" : ""}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-card-foreground">
                    {p.name || "Unnamed"}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{p.email}</p>
                  {p.family_name && (
                    <p className="text-xs text-muted-foreground">Family: {p.family_name}</p>
                  )}
                </div>
                <div className="ml-3 flex items-center gap-2">
                  <Badge
                    variant={p.role === "pending" ? "destructive" : p.role === "admin" ? "default" : "secondary"}
                    className="capitalize"
                  >
                    {p.role}
                  </Badge>
                  {p.role !== "admin" && (
                    <>
                      {p.role !== "approved" && (
                        <Button
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => updateRole.mutate({ userId: p.id, role: "approved" })}
                          disabled={updateRole.isPending}
                          title="Approve"
                        >
                          <CheckCircle className="h-5 w-5" />
                        </Button>
                      )}
                      {p.role !== "pending" && (
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-10 w-10"
                          onClick={() => updateRole.mutate({ userId: p.id, role: "pending" })}
                          disabled={updateRole.isPending}
                          title="Revoke to Pending"
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Guest Requests Section */}
      <div>
        <h3 className="mb-3 font-heading text-base font-semibold text-foreground flex items-center gap-2">
          <Clock className="h-4 w-4 text-accent-foreground" />
          Guest Requests ({guestRequests?.length ?? 0})
        </h3>
        {guestRequests && guestRequests.length > 0 ? (
          <div className="space-y-2">
            {guestRequests.map((gr) => (
              <Card key={gr.id} className={gr.status === "pending" ? "border-accent" : ""}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-card-foreground">{gr.guest_name}</p>
                    {gr.guest_phone && (
                      <p className="text-xs text-muted-foreground">{gr.guest_phone}</p>
                    )}
                  </div>
                  <div className="ml-3 flex items-center gap-2">
                    <Badge
                      variant={gr.status === "pending" ? "outline" : gr.status === "approved" ? "default" : "destructive"}
                      className="capitalize"
                    >
                      {gr.status}
                    </Badge>
                    {gr.status === "pending" && (
                      <>
                        <Button
                          size="icon"
                          className="h-10 w-10"
                          onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "approved" })}
                          disabled={updateGuestStatus.isPending}
                        >
                          <CheckCircle className="h-5 w-5" />
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-10 w-10"
                          onClick={() => updateGuestStatus.mutate({ id: gr.id, status: "rejected" })}
                          disabled={updateGuestStatus.isPending}
                        >
                          <XCircle className="h-5 w-5" />
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No guest requests yet.</p>
        )}
      </div>
    </div>
  );
}
