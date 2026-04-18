import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, ChevronsUpDown, Check, Plus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Venue {
  id: string;
  name: string;
  address: string | null;
  area_hint: string | null;
}

interface VenueSelectorProps {
  value: string | null;
  onChange: (venueId: string | null, name: string, address: string, areaHint: string) => void;
}

export default function VenueSelector({ value, onChange }: VenueSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formName, setFormName] = useState("");
  const [formAreaHint, setFormAreaHint] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [deleteVenue, setDeleteVenue] = useState<Venue | null>(null);
  const [pendingAction, setPendingAction] = useState<
    | { type: "add" }
    | { type: "edit"; venue: Venue }
    | { type: "delete"; venue: Venue }
    | null
  >(null);

  useEffect(() => {
    if (open || !pendingAction) return;

    if (pendingAction.type === "add") {
      setEditingVenue(null);
      setFormName("");
      setFormAreaHint("");
      setFormAddress("");
      setDialogOpen(true);
    } else if (pendingAction.type === "edit") {
      const venue = pendingAction.venue;
      setEditingVenue(venue);
      setFormName(venue.name);
      setFormAreaHint(venue.area_hint ?? "");
      setFormAddress(venue.address ?? "");
      setDialogOpen(true);
    } else {
      setDeleteVenue(pendingAction.venue);
    }

    setPendingAction(null);
  }, [open, pendingAction]);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Venue[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingVenue) {
        const { data, error } = await supabase
          .from("venues")
          .update({ name: formName, address: formAddress || null, area_hint: formAreaHint || null } as any)
          .eq("id", editingVenue.id)
          .select()
          .single();
        if (error) throw error;
        return data as Venue;
      } else {
        const { data, error } = await supabase
          .from("venues")
          .insert({ name: formName, address: formAddress || null, area_hint: formAreaHint || null } as any)
          .select()
          .single();
        if (error) throw error;
        return data as Venue;
      }
    },
    onSuccess: (venue) => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      onChange(venue.id, venue.name, venue.address ?? "", (venue as any).area_hint ?? "");
      closeDialog();
      toast.success(editingVenue ? "Venue updated" : `Venue "${venue.name}" created`);
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save venue"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      if (deleteVenue && value === deleteVenue.id) {
        onChange(null, "", "", "");
      }
      setDeleteVenue(null);
      toast.success("Venue deleted");
    },
    onError: () => toast.error("Failed to delete venue"),
  });

  const openAdd = () => {
    setPendingAction({ type: "add" });
    setOpen(false);
  };

  const openEdit = (venue: Venue, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPendingAction({ type: "edit", venue });
    setOpen(false);
  };

  const openDelete = (venue: Venue, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setPendingAction({ type: "delete", venue });
    setOpen(false);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setPendingAction(null);
    setEditingVenue(null);
    setFormName("");
    setFormAreaHint("");
    setFormAddress("");
  };

  const selected = venues.find((v) => v.id === value);
  const filtered = venues.filter((v) =>
    v.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <Label className="flex items-center gap-1.5 mb-1.5">
        <Building2 className="h-3.5 w-3.5 text-primary" />
        Venue
      </Label>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal h-10"
          >
            {selected ? selected.name : "Select venue…"}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[90]" align="start">
          <div className="p-2">
            <Input
              placeholder="Search venues…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
            />
          </div>

          <div className="max-h-48 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filtered.length > 0 ? (
              filtered.map((venue) => (
                <div
                  key={venue.id}
                  className={cn(
                    "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors group cursor-pointer",
                    value === venue.id && "bg-accent"
                  )}
                  onClick={() => {
                    onChange(venue.id, venue.name, venue.address ?? "", (venue as any).area_hint ?? "");
                    setOpen(false);
                    setSearch("");
                  }}
                >
                  <Check
                    className={cn(
                      "h-4 w-4 shrink-0",
                      value === venue.id ? "opacity-100 text-primary" : "opacity-0"
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{venue.name}</p>
                    {venue.address && (
                      <p className="text-xs text-muted-foreground truncate">{venue.address}</p>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted transition-colors"
                      onClick={(e) => openEdit(venue, e)}
                    >
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button
                      type="button"
                      className="p-1 rounded hover:bg-muted transition-colors"
                      onClick={(e) => openDelete(venue, e)}
                    >
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-3 text-center text-sm text-muted-foreground">No venues found</p>
            )}
          </div>

          {value && (
            <button
              type="button"
              className="w-full border-t px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors text-left"
              onClick={() => {
                onChange(null, "", "", "");
                setOpen(false);
              }}
            >
              Clear selection
            </button>
          )}

          <button
            type="button"
            className="flex w-full items-center gap-2 border-t px-3 py-2 text-sm font-medium text-primary hover:bg-accent transition-colors"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              openAdd();
            }}
          >
            <Plus className="h-4 w-4" />
            Add New Venue
          </button>
        </PopoverContent>
      </Popover>

      {/* Add / Edit Venue Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="sm:max-w-md top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingVenue ? "Edit Venue" : "Add New Venue"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="venue-name">Venue Name</Label>
              <Input
                id="venue-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Br Aleem's House"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="venue-hint">Area Hint</Label>
              <Input
                id="venue-hint"
                value={formAreaHint}
                onChange={(e) => setFormAreaHint(e.target.value)}
                placeholder="e.g. Barsha 3, JLT Cluster D"
                className="mt-1.5"
              />
              <p className="text-xs text-muted-foreground mt-1">Shown before RSVP.</p>
            </div>
            <div>
              <Label htmlFor="venue-address">Full Address / Maps Link</Label>
              <Input
                id="venue-address"
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                placeholder="Full address or Google Maps link"
                className="mt-1.5"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!formName.trim() || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVenue ? "Update Venue" : "Save Venue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteVenue} onOpenChange={(v) => { if (!v) setDeleteVenue(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteVenue?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This venue will be removed. Events using it will keep their current location text but lose the venue link.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteVenue && deleteMutation.mutate(deleteVenue.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
