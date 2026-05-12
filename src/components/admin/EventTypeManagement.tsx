import { useState, lazy, Suspense } from "react";
import { useEventTypes, type EventType } from "@/hooks/useEventTypes";
import { supabase } from "@/integrations/supabase/runtime-client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, GripVertical } from "lucide-react";
import { getEventTypeIcon, EVENT_TYPE_ICON_NAMES } from "@/hooks/useEventTypes";

interface FormState {
  name: string;
  icon: string;
  requires_location: boolean;
  is_virtual: boolean;
  allows_potluck: boolean;
  default_age_group: string;
}

const defaultForm: FormState = {
  name: "",
  icon: "MapPin",
  requires_location: true,
  is_virtual: false,
  allows_potluck: true,
  default_age_group: "All Ages",
};

const ICON_OPTIONS = EVENT_TYPE_ICON_NAMES;

export default function EventTypeManagement() {
  const { data: eventTypes, isLoading } = useEventTypes();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<EventType | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  function openAdd() {
    setEditingId(null);
    setForm(defaultForm);
    setOpen(true);
  }

  function openEdit(et: EventType) {
    setEditingId(et.id);
    setForm({
      name: et.name,
      icon: et.icon,
      requires_location: et.requires_location,
      is_virtual: et.is_virtual,
      allows_potluck: et.allows_potluck,
      default_age_group: (et as any).default_age_group ?? "All Ages",
    });
    setOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const { error } = await supabase
          .from("event_types")
          .update({
            name: form.name.trim(),
            icon: form.icon,
            requires_location: form.requires_location,
            is_virtual: form.is_virtual,
            allows_potluck: form.allows_potluck,
            default_age_group: form.default_age_group,
          } as any)
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Event type updated");
      } else {
        const { error } = await supabase.from("event_types").insert({
          name: form.name.trim(),
          icon: form.icon,
          requires_location: form.requires_location,
          is_virtual: form.is_virtual,
          allows_potluck: form.allows_potluck,
          default_age_group: form.default_age_group,
        } as any);
        if (error) throw error;
        toast.success("Event type created");
      }
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      setOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      // Check if any events use this type
      const { count, error: countErr } = await supabase
        .from("events")
        .select("id", { count: "exact", head: true })
        .eq("event_type_id", deleteTarget.id);
      if (countErr) throw countErr;

      if (count && count > 0) {
        toast.error(
          `Cannot delete "${deleteTarget.name}" — it is used by ${count} event${count > 1 ? "s" : ""}. Reassign those events first.`
        );
        setDeleteTarget(null);
        return;
      }

      const { error } = await supabase
        .from("event_types")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;

      toast.success(`"${deleteTarget.name}" deleted`);
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
      setDeleteTarget(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDrop(targetId: string) {
    if (!dragId || dragId === targetId || !eventTypes) return;
    setReordering(true);
    const items = [...eventTypes];
    const fromIdx = items.findIndex((i) => i.id === dragId);
    const toIdx = items.findIndex((i) => i.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = items.splice(fromIdx, 1);
    items.splice(toIdx, 0, moved);

    try {
      // Update all display_order values
      for (let i = 0; i < items.length; i++) {
        const { error } = await supabase
          .from("event_types")
          .update({ display_order: i + 1 } as any)
          .eq("id", items[i].id);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ["event-types"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to reorder");
    } finally {
      setDragId(null);
      setReordering(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Event Types</h2>
        <Button size="sm" onClick={openAdd} className="gap-1.5">
          <Plus className="h-4 w-4" /> Add Type
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : !eventTypes?.length ? (
        <p className="text-sm text-muted-foreground">No event types yet.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10" />
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Virtual</TableHead>
              <TableHead>Potluck</TableHead>
              <TableHead>Age Group</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventTypes.map((et) => {
              const Icon = getEventTypeIcon(et.icon);
              return (
                <TableRow
                  key={et.id}
                  draggable
                  onDragStart={() => setDragId(et.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(et.id)}
                  className={dragId === et.id ? "opacity-50" : ""}
                >
                  <TableCell className="cursor-grab">
                    <GripVertical className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell>
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                  <TableCell className="font-medium">{et.name}</TableCell>
                  <TableCell>
                    <Badge variant={et.requires_location ? "default" : "secondary"}>
                      {et.requires_location ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={et.is_virtual ? "default" : "secondary"}>
                      {et.is_virtual ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={et.allows_potluck ? "default" : "secondary"}>
                      {et.allows_potluck ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{(et as any).default_age_group ?? "All Ages"}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(et)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget(et)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Event Type" : "Add Event Type"}</DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update the name and default rules for this event type."
                : "Define a new event type with its default rules."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="et-name">Name</Label>
              <Input
                id="et-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Workshop"
              />
            </div>

            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-2">
                {ICON_OPTIONS.map((iconName) => {
                  const Ic = getEventTypeIcon(iconName);
                  return (
                    <Button
                      key={iconName}
                      type="button"
                      size="icon"
                      variant={form.icon === iconName ? "default" : "outline"}
                      onClick={() => setForm((f) => ({ ...f, icon: iconName }))}
                      className="h-9 w-9"
                    >
                      <Ic className="h-4 w-4" />
                    </Button>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="et-location">Requires physical location</Label>
              <Switch
                id="et-location"
                checked={form.requires_location}
                onCheckedChange={(v) => setForm((f) => ({ ...f, requires_location: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="et-virtual">Virtual / online event</Label>
              <Switch
                id="et-virtual"
                checked={form.is_virtual}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_virtual: v }))}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="et-potluck">Allows potluck sign-ups</Label>
              <Switch
                id="et-potluck"
                checked={form.allows_potluck}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allows_potluck: v }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Default Age Group</Label>
              <select
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.default_age_group}
                onChange={(e) => setForm((f) => ({ ...f, default_age_group: e.target.value }))}
              >
                {["All Ages", "Kids (Under 12)", "Youth (13-18)", "Young Adults (18-30)", "Adults (18+)"].map((ag) => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingId ? "Update" : "Create"}
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
              This will permanently remove this event type. If any events are using it, the deletion will be blocked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Checking…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>

      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading venues…</p>}>
        <VenueManagement />
      </Suspense>
    </div>
  );
}

const VenueManagement = lazy(() => import("@/components/admin/VenueManagement"));
