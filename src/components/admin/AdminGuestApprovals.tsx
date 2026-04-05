import { useEventGuestRequests, useUpdateGuestRequestStatus } from "@/hooks/useGuestRequests";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";

export default function AdminGuestApprovals({ eventId }: { eventId: string }) {
  const { data: requests, isLoading } = useEventGuestRequests(eventId);
  const updateStatus = useUpdateGuestRequestStatus();

  const pending = requests?.filter((r: any) => r.status === "pending") ?? [];
  const resolved = requests?.filter((r: any) => r.status !== "pending") ?? [];

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    try {
      await updateStatus.mutateAsync({ id, status });
      toast.success(`Guest ${status}.`);
    } catch {
      toast.error("Failed to update guest request.");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
      </div>
    );
  }

  if (!requests || requests.length === 0) {
    return <p className="text-xs text-muted-foreground italic py-2">No guest requests for this event.</p>;
  }

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">
            Pending Approvals ({pending.length})
          </p>
          <div className="space-y-2">
            {pending.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-card-foreground">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.profiles?.name || r.profiles?.email || "Unknown"}
                  </p>
                  {r.guest_phone && (
                    <p className="text-xs text-muted-foreground">{r.guest_phone}</p>
                  )}
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-green-600 hover:bg-green-50"
                    disabled={updateStatus.isPending}
                    onClick={() => handleAction(r.id, "approved")}
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-destructive hover:bg-red-50"
                    disabled={updateStatus.isPending}
                    onClick={() => handleAction(r.id, "rejected")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {resolved.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            Resolved ({resolved.length})
          </p>
          <div className="space-y-2">
            {resolved.map((r: any) => (
              <div key={r.id} className="flex items-center gap-2 rounded-md border border-border p-3 opacity-70">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-card-foreground">{r.guest_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Requested by {r.profiles?.name || r.profiles?.email || "Unknown"}
                  </p>
                </div>
                <Badge
                  variant={r.status === "approved" ? "default" : "destructive"}
                  className="text-xs capitalize"
                >
                  {r.status}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
