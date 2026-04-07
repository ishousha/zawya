import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Loader2, Upload, Trash2, FileText, Plus, X, Tag, Video, Headphones, Link as LinkIcon, Check, ChevronsUpDown } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const DEFAULT_CATEGORIES = ["Daily Awrad", "Books", "Event Materials", "General"];
const RESOURCE_TYPES = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "video", label: "Video", icon: Video },
  { value: "audio", label: "Audio", icon: Headphones },
  { value: "link", label: "Link", icon: LinkIcon },
] as const;

type ResourceType = typeof RESOURCE_TYPES[number]["value"];

function getResourceIcon(type: string) {
  const found = RESOURCE_TYPES.find((t) => t.value === type);
  return found?.icon ?? FileText;
}

export default function ResourceManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [customCategory, setCustomCategory] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"upload" | "external">("upload");
  const [externalUrl, setExternalUrl] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("pdf");

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
      if (!user) throw new Error("Missing user");
      const finalCategory = useCustom ? customCategory.trim() : category;
      if (!finalCategory) throw new Error("Category is required");

      let fileUrl: string;
      let fileName: string | null = null;
      let fileSize: number | null = null;

      if (source === "upload") {
        if (!file) throw new Error("Missing file");
        const fileExt = file.name.split(".").pop();
        const filePath = `${crypto.randomUUID()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("resources")
          .upload(filePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        fileUrl = filePath;
        fileName = file.name;
        fileSize = file.size;
      } else {
        if (!externalUrl.trim()) throw new Error("URL is required");
        fileUrl = externalUrl.trim();
      }

      const { error: insertError } = await supabase.from("resources").insert({
        title,
        description: description || null,
        file_url: fileUrl,
        file_name: fileName,
        file_size: fileSize,
        uploaded_by: user.id,
        category: finalCategory,
        resource_type: resourceType,
      } as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(source === "upload" ? "Resource uploaded successfully" : "External resource added");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save resource"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: { id: string; file_url: string }) => {
      // Only delete from storage if it's a storage path (not an external URL)
      if (!resource.file_url.startsWith("http")) {
        await supabase.storage.from("resources").remove([resource.file_url]);
      } else if (resource.file_url.includes("supabase")) {
        // Legacy full Supabase URLs
        const url = new URL(resource.file_url);
        const pathParts = url.pathname.split("/resources/");
        const storagePath = pathParts[1] ? decodeURIComponent(pathParts[1]) : "";
        if (storagePath) {
          await supabase.storage.from("resources").remove([storagePath]);
        }
      }
      // External URLs: just delete the DB row, nothing to remove from storage
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
    setCategory("General");
    setCustomCategory("");
    setUseCustom(false);
    setFile(null);
    setSource("upload");
    setExternalUrl("");
    setResourceType("pdf");
  }

  function formatFileSize(bytes: number | null) {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  const isFormValid = title.trim() &&
    (useCustom ? customCategory.trim() : true) &&
    (source === "upload" ? !!file : externalUrl.trim().length > 0);

  return (
    <div className="space-y-4 pt-4">
      {!showForm ? (
        <Button className="w-full h-12" onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Resource
        </Button>
      ) : (
        <Card>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-base font-semibold text-foreground">Add Resource</h3>
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
              <label className="text-sm font-medium text-foreground">Category *</label>
              {!useCustom ? (
                <div className="mt-1 space-y-2">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {STANDARD_CATEGORIES.map((cat) => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => setUseCustom(true)}
                  >
                    + Add custom category
                  </button>
                </div>
              ) : (
                <div className="mt-1 space-y-2">
                  <Input
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    placeholder="Type a custom category name..."
                  />
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline"
                    onClick={() => { setUseCustom(false); setCustomCategory(""); }}
                  >
                    ← Back to standard categories
                  </button>
                </div>
              )}
            </div>

            {/* Resource Type */}
            <div>
              <label className="text-sm font-medium text-foreground">Resource Type</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {RESOURCE_TYPES.map((rt) => {
                  const Icon = rt.icon;
                  return (
                    <button
                      key={rt.value}
                      type="button"
                      onClick={() => setResourceType(rt.value)}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        resourceType === rt.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      {rt.label}
                    </button>
                  );
                })}
              </div>
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

            {/* Source Toggle */}
            <div>
              <label className="text-sm font-medium text-foreground">Resource Source *</label>
              <RadioGroup
                value={source}
                onValueChange={(v) => setSource(v as "upload" | "external")}
                className="mt-1.5 flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="upload" id="source-upload" />
                  <Label htmlFor="source-upload" className="text-sm cursor-pointer">Upload File</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="external" id="source-external" />
                  <Label htmlFor="source-external" className="text-sm cursor-pointer">External Link</Label>
                </div>
              </RadioGroup>
            </div>

            {source === "upload" ? (
              <div>
                <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed border-input p-4 hover:bg-muted/50 transition-colors">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {file ? file.name : "Choose a file..."}
                  </span>
                  <input
                    type="file"
                    className="hidden"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </label>
              </div>
            ) : (
              <div>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="Paste URL here (OneDrive, YouTube, etc.)"
                  type="url"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Paste a link to an externally hosted file or video
                </p>
              </div>
            )}

            <Button
              className="w-full h-11"
              onClick={() => uploadMutation.mutate()}
              disabled={uploadMutation.isPending || !isFormValid}
            >
              {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {source === "upload" ? "Upload Resource" : "Add External Resource"}
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
          {resources.map((res) => {
            const Icon = getResourceIcon((res as any).resource_type || "pdf");
            return (
              <Card key={res.id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-foreground truncate">{res.title}</h4>
                    {res.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{res.description}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {(res as any).category || "General"}
                      </Badge>
                      {res.file_url.startsWith("http") && !res.file_url.includes("supabase") && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <LinkIcon className="h-2.5 w-2.5" />
                          External
                        </Badge>
                      )}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
