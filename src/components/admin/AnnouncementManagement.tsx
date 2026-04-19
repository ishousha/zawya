import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Pencil, Trash2, Loader2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type Variant = "info" | "success" | "warning";

interface Announcement {
  id: string;
  title: string;
  message: string;
  link_url: string | null;
  link_label: string | null;
  variant: Variant | string;
  active: boolean;
  starts_at: string;
  ends_at: string | null;
  created_at: string;
}

interface FormState {
  title: string;
  message: string;
  link_url: string;
  link_label: string;
  variant: Variant;
  active: boolean;
  ends_at: string; // datetime-local; empty = no expiry
}

const EMPTY_FORM: FormState = {
  title: "",
  message: "",
  link_url: "",
  link_label: "",
  variant: "info",
  active: true,
  ends_at: "",
};

export default function AnnouncementManagement() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Announcement[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditing(a);
    setForm({
      title: a.title,
      message: a.message,
      link_url: a.link_url ?? "",
      link_label: a.link_label ?? "",
      variant: (a.variant as Variant) || "info",
      active: a.active,
      ends_at: a.ends_at ? format(new Date(a.ends_at), "yyyy-MM-dd'T'HH:mm") : "",
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Not authenticated");
      const payload = {
        title: form.title.trim(),
        message: form.message.trim(),
        link_url: form.link_url.trim() || null,
        link_label: form.link_label.trim() || null,
        variant: form.variant,
        active: form.active,
        ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      };

      if (editing) {
        const { error } = await supabase
          .from("announcements")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("announcements")
          .insert({ ...payload, created_by: userId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Announcement updated" : "Announcement published");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save announcement"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("announcements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Announcement deleted");
      queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
      queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
      setDeleteTarget(null);
    },
    onError: () => toast.error("Failed to delete announcement"),
  });

  const toggleActive = async (a: Announcement) => {
    const { error } = await supabase
      .from("announcements")
      .update({ active: !a.active })
      .eq("id", a.id);
    if (error) {
      toast.error("Failed to toggle");
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["admin-announcements"] });
    queryClient.invalidateQueries({ queryKey: ["active-announcement"] });
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-primary" />
          <div>
            <h2 className="font-heading text-lg font-semibold">Announcements</h2>
            <p className="text-xs text-muted-foreground">
              Sticky banner shown at top of every page until each user dismisses it.
            </p>
          </div>
        </div>
        <Button size="sm" onClick={openCreate} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No announcements yet. Create one to alert all users about a new release or important update.
        </div>
      ) : (
        <ul className="space-y-2">
          {announcements.map((a) => (
            <li
              key={a.id}
              className="rounded-lg border border-border bg-card p-3 space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm truncate">{a.title}</p>
                    <span
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                        a.variant === "warning"
                          ? "bg-amber-500/20 text-amber-900 dark:text-amber-100"
                          : a.variant === "success"
                            ? "bg-emerald-500/20 text-emerald-900 dark:text-emerald-100"
                            : "bg-primary/15 text-primary"
                      }`}
                    >
                      {a.variant}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{a.message}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Created {format(new Date(a.created_at), "MMM d, yyyy")}
                    {a.ends_at && ` · Ends ${format(new Date(a.ends_at), "MMM d, yyyy")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch checked={a.active} onCheckedChange={() => toggleActive(a)} />
                </div>
              </div>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(a)}
                  className="h-8 gap-1"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleteTarget(a)}
                  className="h-8 gap-1 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md top-4 translate-y-0 sm:top-1/2 sm:-translate-y-1/2 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit announcement" : "New announcement"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="ann-title">Title</Label>
              <Input
                id="ann-title"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="e.g. New release: faster check-ins"
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="ann-message">Message</Label>
              <Textarea
                id="ann-message"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                placeholder="Short note shown to all users."
                rows={3}
                className="mt-1.5"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="ann-link">Link URL (optional)</Label>
                <Input
                  id="ann-link"
                  value={form.link_url}
                  onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))}
                  placeholder="/library or https://..."
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="ann-link-label">Link label</Label>
                <Input
                  id="ann-link-label"
                  value={form.link_label}
                  onChange={(e) => setForm((f) => ({ ...f, link_label: e.target.value }))}
                  placeholder="Learn more"
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Variant</Label>
                <Select
                  value={form.variant}
                  onValueChange={(v) => setForm((f) => ({ ...f, variant: v as Variant }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="success">Success</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="ann-ends">Ends at (optional)</Label>
                <Input
                  id="ann-ends"
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-muted-foreground">Toggle to show or hide for all users.</p>
              </div>
              <Switch
                checked={form.active}
                onCheckedChange={(c) => setForm((f) => ({ ...f, active: c }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              onClick={() => saveMutation.mutate()}
              disabled={!form.title.trim() || !form.message.trim() || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Update announcement" : "Publish announcement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => !v && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the announcement and all dismissal records. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
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
