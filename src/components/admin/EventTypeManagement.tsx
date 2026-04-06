import { useState } from "react";
import { useEventTypes, type EventType } from "@/hooks/useEventTypes";
import { supabase } from "@/integrations/supabase/client";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil } from "lucide-react";
import { getEventTypeIcon } from "@/hooks/useEventTypes";

interface FormState {
  name: string;
  icon: string;
  requires_location: boolean;
  allows_potluck: boolean;
}

const defaultForm: FormState = {
  name: "",
  icon: "MapPin",
  requires_location: true,
  allows_potluck: true,
};

const ICON_OPTIONS = ["MapPin", "Video", "Users", "BookOpen", "Mountain", "Handshake"];

export default function EventTypeManagement() {
  const { data: eventTypes, isLoading } = useEventTypes();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [saving, setSaving] = useState(false);

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
      allows_potluck: et.allows_potluck,
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
            allows_potluck: form.allows_potluck,
          })
          .eq("id", editingId);
        if (error) throw error;
        toast.success("Event type updated");
      } else {
        const { error } = await supabase.from("event_types").insert({
          name: form.name.trim(),
          icon: form.icon,
          requires_location: form.requires_location,
          allows_potluck: form.allows_potluck,
        });
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

  return (
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
              <TableHead>Icon</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Potluck</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {eventTypes.map((et) => {
              const Icon = getEventTypeIcon(et.icon);
              return (
                <TableRow key={et.id}>
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
                    <Badge variant={et.allows_potluck ? "default" : "secondary"}>
                      {et.allows_potluck ? "Yes" : "No"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(et)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

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
              <Label htmlFor="et-potluck">Allows potluck sign-ups</Label>
              <Switch
                id="et-potluck"
                checked={form.allows_potluck}
                onCheckedChange={(v) => setForm((f) => ({ ...f, allows_potluck: v }))}
              />
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
    </div>
  );
}
