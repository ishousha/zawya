import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Building2, ChevronsUpDown, Check, Plus, Loader2, Pencil, Trash2, ArrowLeft } from "lucide-react";
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

type ViewMode = "list" | "form";

export default function VenueSelector({ value, onChange }: VenueSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formName, setFormName] = useState("");
  const [formAreaHint, setFormAreaHint] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [deleteVenue, setDeleteVenue] = useState<Venue | null>(null);

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
      toast.success(editingVenue ? "Venue updated" : `Venue "${venue.name}" created`);
      resetForm();
      setOpen(false);
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

  const resetForm = () => {
    setView("list");
    setEditingVenue(null);
    setFormName("");
    setFormAreaHint("");
    setFormAddress("");
  };

  const openAdd = () => {
    setEditingVenue(null);
    setFormName("");
    setFormAreaHint("");
    setFormAddress("");
    setView("form");
  };

  const openEdit = (venue: Venue, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditingVenue(venue);
    setFormName(venue.name);
    setFormAreaHint(venue.area_hint ?? "");
    setFormAddress(venue.address ?? "");
    setView("form");
  };

  const openDelete = (venue: Venue, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteVenue(venue);
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

      <div className="flex gap-1.5">
        <Popover
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) resetForm();
          }}
        >
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className="flex-1 justify-between font-normal h-10 min-w-0"
            >
              <span className="truncate">{selected ? selected.name : "Select venue…"}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0 z-[90]"
          align="start"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {view === "list" ? (
            <>
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
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          onClick={(e) => openEdit(venue, e)}
                          aria-label={`Edit ${venue.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          onClick={(e) => openDelete(venue, e)}
                          aria-label={`Delete ${venue.name}`}
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
                className="flex w-full items-center gap-2 border-t px-3 py-2.5 text-sm font-medium text-primary hover:bg-accent transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  openAdd();
                }}
              >
                <Plus className="h-4 w-4" />
                Add New Venue
              </button>
            </>
          ) : (
            <div className="p-3 space-y-3">
              <div className="flex items-center gap-2 -mt-1 -mx-1">
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="p-1 rounded hover:bg-muted transition-colors"
                  aria-label="Back to list"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold">
                  {editingVenue ? "Edit Venue" : "Add New Venue"}
                </p>
              </div>

              <div>
                <Label htmlFor="venue-name" className="text-xs">Venue Name</Label>
                <Input
                  id="venue-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Br Aleem's House"
                  className="mt-1 h-9"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="venue-hint" className="text-xs">Area Hint</Label>
                <Input
                  id="venue-hint"
                  value={formAreaHint}
                  onChange={(e) => setFormAreaHint(e.target.value)}
                  placeholder="e.g. Barsha 3, JLT Cluster D"
                  className="mt-1 h-9"
                />
                <p className="text-[11px] text-muted-foreground mt-0.5">Shown before RSVP.</p>
              </div>
              <div>
                <Label htmlFor="venue-address" className="text-xs">Full Address / Maps Link</Label>
                <Input
                  id="venue-address"
                  value={formAddress}
                  onChange={(e) => setFormAddress(e.target.value)}
                  placeholder="Full address or Google Maps link"
                  className="mt-1 h-9"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => resetForm()}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => saveMutation.mutate()}
                  disabled={!formName.trim() || saveMutation.isPending}
                  className="flex-1"
                >
                  {saveMutation.isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {editingVenue ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

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
