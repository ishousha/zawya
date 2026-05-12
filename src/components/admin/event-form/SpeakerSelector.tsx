import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Mic, Check, ChevronsUpDown, X, Plus, Pencil, Trash2, Loader2, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Speaker {
  id: string;
  name: string;
  bio: string | null;
  image_url: string | null;
}

interface SpeakerSelectorProps {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

type ViewMode = "list" | "form";

export default function SpeakerSelector({ selectedIds, onChange }: SpeakerSelectorProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [view, setView] = useState<ViewMode>("list");
  const [editing, setEditing] = useState<Speaker | null>(null);
  const [formName, setFormName] = useState("");
  const [formBio, setFormBio] = useState("");
  const [formImageUrl, setFormImageUrl] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Speaker | null>(null);

  const { data: speakers = [] } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name, bio, image_url")
        .order("name");
      if (error) throw error;
      return data as Speaker[];
    },
  });

  const selectedSpeakers = useMemo(
    () => speakers.filter((s) => selectedIds.includes(s.id)),
    [speakers, selectedIds]
  );

  const filtered = useMemo(
    () => speakers.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())),
    [speakers, search]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formName.trim(),
        bio: formBio.trim() || null,
        image_url: formImageUrl.trim() || null,
      };
      if (editing) {
        const { data, error } = await supabase
          .from("speakers")
          .update(payload as any)
          .eq("id", editing.id)
          .select()
          .single();
        if (error) throw error;
        return data as Speaker;
      } else {
        const { data, error } = await supabase
          .from("speakers")
          .insert(payload as any)
          .select()
          .single();
        if (error) throw error;
        return data as Speaker;
      }
    },
    onSuccess: (sp) => {
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
      if (!editing) {
        // auto-select newly created speaker
        onChange([...selectedIds, sp.id]);
      }
      toast.success(editing ? "Special guest updated" : `"${sp.name}" added`);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Failed to save special guest"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("speakers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["speakers"] });
      if (deleteTarget) {
        onChange(selectedIds.filter((s) => s !== deleteTarget.id));
      }
      setDeleteTarget(null);
      toast.success("Special guest deleted");
    },
    onError: (err: any) => toast.error(err?.message || "Failed to delete"),
  });

  const resetForm = () => {
    setView("list");
    setEditing(null);
    setFormName("");
    setFormBio("");
    setFormImageUrl("");
  };

  const openAdd = () => {
    setEditing(null);
    setFormName("");
    setFormBio("");
    setFormImageUrl("");
    setView("form");
  };

  const openEdit = (s: Speaker, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditing(s);
    setFormName(s.name);
    setFormBio(s.bio ?? "");
    setFormImageUrl(s.image_url ?? "");
    setView("form");
  };

  const openDelete = (s: Speaker, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDeleteTarget(s);
  };

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((s) => s !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Mic className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Featured Special Guests</h3>
      </div>

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
            className="w-full justify-between h-auto min-h-10 font-normal"
          >
            <span className="text-sm text-muted-foreground">
              {selectedIds.length === 0
                ? "Select special guests…"
                : `${selectedIds.length} special guest${selectedIds.length > 1 ? "s" : ""} selected`}
            </span>
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
                  placeholder="Search special guests…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-9"
                />
              </div>

              <div className="max-h-56 overflow-y-auto">
                {filtered.length > 0 ? (
                  filtered.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent transition-colors group cursor-pointer",
                        selectedIds.includes(s.id) && "bg-accent"
                      )}
                      onClick={() => toggle(s.id)}
                    >
                      <Check
                        className={cn(
                          "h-4 w-4 shrink-0",
                          selectedIds.includes(s.id) ? "opacity-100 text-primary" : "opacity-0"
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{s.name}</p>
                        {s.bio && (
                          <p className="text-xs text-muted-foreground truncate">{s.bio}</p>
                        )}
                      </div>
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          onClick={(e) => openEdit(s, e)}
                          aria-label={`Edit ${s.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button
                          type="button"
                          className="p-1.5 rounded hover:bg-muted transition-colors"
                          onClick={(e) => openDelete(s, e)}
                          aria-label={`Delete ${s.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="py-3 text-center text-sm text-muted-foreground">No special guests found</p>
                )}
              </div>

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
                Add New Special Guest
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
                  {editing ? "Edit Special Guest" : "Add New Special Guest"}
                </p>
              </div>

              <div>
                <Label htmlFor="sp-name" className="text-xs">Name</Label>
                <Input
                  id="sp-name"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Sheikh Hamza Yusuf"
                  className="mt-1 h-9"
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="sp-bio" className="text-xs">Short Bio</Label>
                <Textarea
                  id="sp-bio"
                  value={formBio}
                  onChange={(e) => setFormBio(e.target.value)}
                  placeholder="Brief introduction shown to members"
                  className="mt-1 min-h-16 text-sm"
                  rows={3}
                />
              </div>
              <div>
                <Label htmlFor="sp-img" className="text-xs">Image URL</Label>
                <Input
                  id="sp-img"
                  value={formImageUrl}
                  onChange={(e) => setFormImageUrl(e.target.value)}
                  placeholder="https://…"
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
                  {editing ? "Update" : "Save"}
                </Button>
              </div>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {selectedSpeakers.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedSpeakers.map((s) => (
            <Badge key={s.id} variant="secondary" className="gap-1 pr-1">
              {s.name}
              <button
                type="button"
                onClick={() => toggle(s.id)}
                className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-1">
        Select, add, or edit special guests without leaving this form.
      </p>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(v) => { if (!v) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteTarget?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This special guest will be removed from all events that reference them.
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
