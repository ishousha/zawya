import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { generateQRHash } from "@/lib/qr-hash";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, Loader2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface WalkInRsvpModalProps {
  eventId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WalkInRsvpModal({ eventId, open, onOpenChange }: WalkInRsvpModalProps) {
  const queryClient = useQueryClient();
  const [comboOpen, setComboOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [adultsCount, setAdultsCount] = useState(1);
  const [childrenCount, setChildrenCount] = useState(0);

  const { data: approvedUsers, isLoading: loadingUsers } = useQuery({
    queryKey: ["approved-users-for-walkin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, email, family_name")
        .in("role", ["approved", "admin", "moderator", "guest"])
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  // Filter out users who already have an RSVP for this event
  const { data: existingRsvpUserIds } = useQuery({
    queryKey: ["existing-rsvp-users", eventId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rsvps")
        .select("user_id")
        .eq("event_id", eventId);
      if (error) throw error;
      return new Set((data ?? []).map((r) => r.user_id));
    },
    enabled: open,
  });

  const availableUsers = useMemo(() => {
    if (!approvedUsers) return [];
    if (!existingRsvpUserIds) return approvedUsers;
    return approvedUsers.filter((u) => !existingRsvpUserIds.has(u.id));
  }, [approvedUsers, existingRsvpUserIds]);

  const selectedUser = approvedUsers?.find((u) => u.id === selectedUserId);

  const walkInMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUserId) throw new Error("No user selected");

      const rsvpId = crypto.randomUUID();
      const qrHash = await generateQRHash(rsvpId);
      const totalGuests = adultsCount + childrenCount;

      const { error } = await supabase.from("rsvps").insert({
        id: rsvpId,
        event_id: eventId,
        user_id: selectedUserId,
        guests_count: totalGuests,
        checked_in: true,
        qr_hash: qrHash,
        attending_dependents: childrenCount > 0
          ? Array.from({ length: childrenCount }, (_, i) => ({
              name: `Child ${i + 1}`,
              type: "dependent",
              age: null,
            }))
          : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Walk-in RSVP created for ${selectedUser?.name || "user"}`);
      queryClient.invalidateQueries({ queryKey: ["admin-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["host-rsvps", eventId] });
      queryClient.invalidateQueries({ queryKey: ["existing-rsvp-users", eventId] });
      resetForm();
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Failed to create walk-in RSVP: " + (err as Error).message);
    },
  });

  const resetForm = () => {
    setSelectedUserId(null);
    setAdultsCount(1);
    setChildrenCount(0);
    setComboOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); onOpenChange(v); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 font-heading">
            <UserPlus className="h-5 w-5 text-primary" />
            Add Walk-In
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* User search combobox */}
          <div className="space-y-2">
            <Label>Select Member</Label>
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between h-10 font-normal"
                >
                  {selectedUser
                    ? `${selectedUser.name || selectedUser.email}${selectedUser.family_name ? ` — ${selectedUser.family_name}` : ""}`
                    : "Search members..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[calc(100vw-4rem)] sm:w-[380px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search by name..." />
                  <CommandList>
                    <CommandEmpty>
                      {loadingUsers ? "Loading..." : "No members found."}
                    </CommandEmpty>
                    <CommandGroup>
                      {availableUsers.map((user) => (
                        <CommandItem
                          key={user.id}
                          value={`${user.name || ""} ${user.email || ""} ${user.family_name || ""}`}
                          onSelect={() => {
                            setSelectedUserId(user.id);
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUserId === user.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
                            {user.family_name && (
                              <p className="text-xs text-muted-foreground">{user.family_name}</p>
                            )}
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Headcount inputs */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="adults">Adults</Label>
              <Input
                id="adults"
                type="number"
                min={1}
                max={10}
                value={adultsCount}
                onChange={(e) => setAdultsCount(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="children">Children</Label>
              <Input
                id="children"
                type="number"
                min={0}
                max={10}
                value={childrenCount}
                onChange={(e) => setChildrenCount(Math.max(0, Math.min(10, parseInt(e.target.value) || 0)))}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Total headcount: {adultsCount + childrenCount} · Will be auto-checked-in
          </p>

          <Button
            onClick={() => walkInMutation.mutate()}
            disabled={!selectedUserId || walkInMutation.isPending}
            className="w-full h-11 gap-2"
          >
            {walkInMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            Confirm Walk-In
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
