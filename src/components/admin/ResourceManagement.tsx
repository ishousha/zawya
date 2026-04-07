import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Upload, Trash2, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

export default function ResourceManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["admin-resources"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file || !user) throw new Error("Missing file or user");

      const fileExt = file.name.split(".").pop();
      const filePath = `${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(filePath, file, { contentType: file.type });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("resources")
        .getPublicUrl(filePath);

      const { error: insertError } = await supabase.from("resources").insert({
        title,
        description: description || null,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource uploaded successfully");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Upload failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: { id: string; file_url: string }) => {
      // Extract file path from URL
      const url = new URL(resource.file_url);
      const pathParts = url.pathname.split("/resources/");
      if (pathParts[1]) {
        await supabase.storage.from("resources").remove([decodeURIComponent(pathParts[1])]);
      }
      const { error } = await supabase.from("resources").delete().eq("id", resource.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource deleted");
    },
    onError: () => toast.error("Failed to delete resource"),
  });

  function resetForm() {
    setShowForm(false);
    setTitle("");
    setDescription("");
    setFile(null);
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div className="space-y-4 pt-4">
      {!showForm ? (
        <Button className="w-full h-12" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Upload Resource
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-foreground">Upload Resource</h3>
              <Button size="icon" variant="ghost" onClick={resetForm}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Title *</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Daily Wird, Community Handbook"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">Description</label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description of this resource..."
                className="mt-1"
                rows={2}
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground">PDF File *</label>
              <div className="mt-1">
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input p-4 hover:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : "Choose a PDF file..."}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            </div>

            <Button
              className="w-full h-11"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !title.trim() || !file}
            >
              {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Upload Resource
            </Button>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !resources?.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">No resources uploaded yet.</p>
      ) : (
        <div className="space-y-3">
          {resources.map((res) => (
            <Card key={res.id}>
              <CardContent className="flex items-start gap-3 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{res.title}</h4>
                  {res.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{res.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {res.file_size && <span>{formatFileSize(res.file_size)}</span>}
                    <span>·</span>
                    <span>{format(new Date(res.created_at), "MMM d, yyyy")}</span>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate({ id: res.id, file_url: res.file_url })}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
