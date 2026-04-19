import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Loader2, Building2 } from "lucide-react";
import { toast } from "sonner";

interface Venue {
  id: string;
  name: string;
  address: string | null;
  area_hint: string | null;
}

export default function VenueManagement() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null);
  const [formName, setFormName] = useState("");
  const [formAreaHint, setFormAreaHint] = useState("");
  const [formAddress, setFormAddress] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Venue | null>(null);

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ["venues"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("venues")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Venue[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName.trim(),
        area_hint: formAreaHint.trim() || null,
        address: formAddress.trim() || null,
      };
      if (editingVenue) {
        const { error } = await supabase.from("venues").update(payload as any).eq("id", editingVenue.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("venues").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      closeDialog();
      toast.success(editingVenue ? "Venue updated" : "Venue created");
    },
    onError: () => toast.error("Failed to save venue"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // Check if any events reference this venue
      const { count } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("venue_id", id);
      if (count && count > 0) {
        throw new Error(`Cannot delete — ${count} event${count > 1 ? "s" : ""} use this venue. Reassign them first.`);
      }
      const { error } = await supabase.from("venues").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["venues"] });
      setDeleteTarget(null);
      toast.success("Venue deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to delete venue");
      setDeleteTarget(null);
    },
  });

  function openAdd() {
    setEditingVenue(null);
    setFormName("");
    setFormAreaHint("");
    setFormAddress("");
    setOpen(true);
  }

  function openEdit(v: Venue) {
    setEditingVenue(v);
    setFormName(v.name);
    setFormAreaHint(v.area_hint ?? "");
    setFormAddress(v.address ?? "");
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setEditingVenue(null);
    setFormName("");
    setFormAreaHint("");
    setFormAddress("");
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          Venues
        </h2>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Venue
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : !venues.length ? (
        <p className="text-sm text-muted-foreground text-center py-4">No venues yet. Add one to get started.</p>
      ) : (
        <Table>
          <TableHeader>
          <TableRow>
              <TableHead>Location Name</TableHead>
              <TableHead>Street Address</TableHead>
              <TableHead>Hint / Directions</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {venues.map((v) => (
              <TableRow key={v.id}>
                <TableCell className="font-medium">{v.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{v.address || "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground italic max-w-[200px] truncate">{v.area_hint || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(v)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteTarget(v)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingVenue ? "Edit Venue" : "Add New Venue"}</DialogTitle>
            <DialogDescription>
              {editingVenue ? "Update this venue's details." : "Add a new location that organizers can select when creating events."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="v-name">Location Name <span className="text-destructive">*</span></Label>
              <Input id="v-name" value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="e.g. Zawya Community Center" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="v-addr">Street Address <span className="text-destructive">*</span></Label>
              <Input id="v-addr" value={formAddress} onChange={(e) => setFormAddress(e.target.value)} placeholder="e.g. 123 Main St, Dubai" className="mt-1.5" />
              <p className="text-xs text-muted-foreground mt-1">Used to open Apple/Google Maps when members tap the address.</p>
            </div>
            <div>
              <Label htmlFor="v-hint">Location Hint / Directions <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea id="v-hint" value={formAreaHint} onChange={(e) => setFormAreaHint(e.target.value)} placeholder="e.g. Park in the rear lot, ring the bell at the green gate" className="mt-1.5 min-h-[72px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!formName.trim() || !formAddress.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingVenue ? "Update" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This venue will be permanently removed. If any events reference it, deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Checking…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
