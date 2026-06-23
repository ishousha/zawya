import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, Upload, Trash2, FileText, Plus, X, Tag, Video, Headphones,
  Link as LinkIcon, Check, ChevronsUpDown, Pencil, Search, CalendarDays, Mic, Calendar as CalendarIcon, Share2, ImageIcon
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import SpeakerSelector from "@/components/admin/event-form/SpeakerSelector";
import { useShareResource } from "@/components/ShareResourceDialog";

const DEFAULT_CATEGORIES = ["Awrad/Litanies", "Books", "Event Materials", "General", "Other"];
const RESOURCE_TYPES = [
  { value: "pdf", label: "PDF", icon: FileText },
  { value: "video", label: "Video", icon: Video },
  { value: "audio", label: "Audio", icon: Headphones },
  { value: "link", label: "Link", icon: LinkIcon },
] as const;

type ResourceType = typeof RESOURCE_TYPES[number]["value"];

function getResourceIcon(type: string) {
  return RESOURCE_TYPES.find((t) => t.value === type)?.icon ?? FileText;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Compact tag chip input — Enter or comma adds a tag. */
function TagInput({
  value,
  onChange,
  suggestions = [],
  placeholder = "Add a tag and press Enter",
}: {
  value: string[];
  onChange: (next: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");
  const addTag = (raw: string) => {
    const t = raw.trim().replace(/^#/, "");
    if (!t) return;
    if (value.some((v) => v.toLowerCase() === t.toLowerCase())) return;
    onChange([...value, t]);
    setDraft("");
  };
  const filtered = useMemo(() => {
    const q = draft.trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter((s) => s.toLowerCase().includes(q) && !value.some((v) => v.toLowerCase() === s.toLowerCase()))
      .slice(0, 6);
  }, [draft, suggestions, value]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2 min-h-10">
        {value.map((t) => (
          <Badge key={t} variant="secondary" className="gap-1 pr-1">
            #{t}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== t))}
              className="ml-0.5 rounded-full hover:bg-muted p-0.5"
              aria-label={`Remove ${t}`}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === "Backspace" && !draft && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => draft && addTag(draft)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] bg-transparent outline-none text-sm"
        />
      </div>
      {filtered.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="text-[10px] text-muted-foreground self-center mr-1">Suggestions:</span>
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="text-[11px] px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-muted/70 transition-colors"
            >
              + {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface EventLite {
  id: string;
  title: string;
  date_time: string;
}

interface SpeakerLite {
  id: string;
  name: string;
}

interface ResourceRow {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  category: string;
  resource_type: string | null;
  event_id: string | null;
  speaker_ids: string[] | null;
  tags: string[] | null;
  resource_date: string | null;
  short_code: string | null;
}

const DATE_PRESETS = [
  { value: "any", label: "Any time" },
  { value: "month", label: "This month" },
  { value: "3months", label: "Last 3 months" },
  { value: "year", label: "This year" },
  { value: "older", label: "Older" },
] as const;

type DatePreset = typeof DATE_PRESETS[number]["value"];

function inDatePreset(iso: string | null | undefined, preset: DatePreset): boolean {
  if (preset === "any" || !iso) return preset === "any" ? true : false;
  const d = new Date(iso);
  const now = new Date();
  if (preset === "month") {
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }
  if (preset === "3months") {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
    return d >= cutoff;
  }
  if (preset === "year") {
    return d.getFullYear() === now.getFullYear();
  }
  if (preset === "older") {
    return d.getFullYear() < now.getFullYear();
  }
  return true;
}

export default function ResourceManagement() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { open: openShare, dialog: shareDialog } = useShareResource();

  // ----- Form state -----
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [resourceType, setResourceType] = useState<ResourceType>("pdf");
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<"upload" | "external">("upload");
  const [externalUrl, setExternalUrl] = useState("");
  const [linkedEventId, setLinkedEventId] = useState<string | null>(null);
  const [eventPickerOpen, setEventPickerOpen] = useState(false);
  const [eventSearch, setEventSearch] = useState("");
  const [speakerIds, setSpeakerIds] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [resourceDate, setResourceDate] = useState<string>("");

  // ----- Admin list filter state -----
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("All");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSpeaker, setFilterSpeaker] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<DatePreset>("any");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");

  // ----- Queries -----
  const { data: resources, isLoading } = useQuery({
    queryKey: ["admin-resources"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]) as ResourceRow[];
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["admin-resource-events"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time")
        .order("date_time", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) as EventLite[];
    },
  });

  const { data: speakers = [] } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return (data as any[]) as SpeakerLite[];
    },
  });

  const eventById = useMemo(() => {
    const map = new Map<string, EventLite>();
    events.forEach((e) => map.set(e.id, e));
    return map;
  }, [events]);

  const speakerById = useMemo(() => {
    const map = new Map<string, SpeakerLite>();
    speakers.forEach((s) => map.set(s.id, s));
    return map;
  }, [speakers]);

  // When an event is selected, auto-suggest its speakers (only if user hasn't picked any yet)
  useEffect(() => {
    if (!linkedEventId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("event_speakers")
        .select("speaker_id")
        .eq("event_id", linkedEventId);
      if (cancelled || !data) return;
      const ids = (data as { speaker_id: string }[]).map((r) => r.speaker_id);
      if (ids.length === 0) return;
      setSpeakerIds((prev) => (prev.length === 0 ? ids : prev));
      // Auto-fill session date from event if blank
      const ev = eventById.get(linkedEventId);
      if (ev && !resourceDate) setResourceDate(ev.date_time.slice(0, 10));
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedEventId]);

  const allCategories = useMemo(() => {
    const dbCats = resources?.map((r) => r.category).filter(Boolean) ?? [];
    return Array.from(new Set([...DEFAULT_CATEGORIES, ...dbCats])).sort();
  }, [resources]);

  const allTagSuggestions = useMemo(() => {
    const set = new Set<string>();
    resources?.forEach((r) => (r.tags ?? []).forEach((t) => set.add(t)));
    return Array.from(set).sort();
  }, [resources]);

  const filteredCategoryOptions = useMemo(() => {
    if (!catSearch.trim()) return allCategories;
    const q = catSearch.toLowerCase();
    return allCategories.filter((c) => c.toLowerCase().includes(q));
  }, [allCategories, catSearch]);

  const isNewCategory =
    catSearch.trim() &&
    !allCategories.some((c) => c.toLowerCase() === catSearch.trim().toLowerCase());

  const filteredEvents = useMemo(() => {
    const q = eventSearch.trim().toLowerCase();
    if (!q) return events.slice(0, 50);
    return events
      .filter((e) => e.title.toLowerCase().includes(q))
      .slice(0, 50);
  }, [events, eventSearch]);

  // ----- Mutations -----
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Missing user");
      if (!category.trim()) throw new Error("Category is required");

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
        category: category.trim(),
        resource_type: resourceType,
        event_id: linkedEventId,
        speaker_ids: speakerIds,
        tags,
        resource_date: resourceDate || null,
      } as any);
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success(source === "upload" ? "Resource uploaded" : "External resource added");
      resetForm();
    },
    onError: (err: any) => toast.error(err.message || "Failed to save resource"),
  });

  const editMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ResourceRow> }) => {
      const { error } = await supabase.from("resources").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-resources"] });
      queryClient.invalidateQueries({ queryKey: ["resources"] });
      toast.success("Resource updated");
      resetForm();
    },
    onError: () => toast.error("Failed to update resource"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (resource: { id: string; file_url: string }) => {
      if (!resource.file_url.startsWith("http")) {
        await supabase.storage.from("resources").remove([resource.file_url]);
      } else if (resource.file_url.includes("supabase")) {
        const url = new URL(resource.file_url);
        const pathParts = url.pathname.split("/resources/");
        const storagePath = pathParts[1] ? decodeURIComponent(pathParts[1]) : "";
        if (storagePath) {
          await supabase.storage.from("resources").remove([storagePath]);
        }
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

  function startEdit(res: ResourceRow) {
    setEditingId(res.id);
    setTitle(res.title);
    setDescription(res.description || "");
    setCategory(res.category || "General");
    setResourceType((res.resource_type as ResourceType) || "pdf");
    setLinkedEventId(res.event_id ?? null);
    setSpeakerIds(res.speaker_ids ?? []);
    setTags(res.tags ?? []);
    setResourceDate(res.resource_date ?? "");
    setShowForm(true);
  }

  function resetForm() {
    setShowForm(false);
    setEditingId(null);
    setTitle("");
    setDescription("");
    setCategory("General");
    setCatSearch("");
    setFile(null);
    setSource("upload");
    setExternalUrl("");
    setResourceType("pdf");
    setLinkedEventId(null);
    setSpeakerIds([]);
    setTags([]);
    setResourceDate("");
  }

  const isFormValid =
    title.trim() &&
    category.trim() &&
    (source === "upload" ? !!file : externalUrl.trim().length > 0);

  // ----- Filtered admin list -----
  const visibleResources = useMemo(() => {
    if (!resources) return [];
    let list = resources;
    if (filterCategory !== "All") list = list.filter((r) => (r.category || "General") === filterCategory);
    if (filterType !== "all") list = list.filter((r) => (r.resource_type || "pdf") === filterType);
    if (filterSpeaker !== "all") {
      list = list.filter((r) => (r.speaker_ids ?? []).includes(filterSpeaker));
    }
    if (filterDate !== "any") {
      list = list.filter((r) => inDatePreset(r.resource_date ?? r.created_at, filterDate));
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      const aDate = new Date(a.resource_date ?? a.created_at).getTime();
      const bDate = new Date(b.resource_date ?? b.created_at).getTime();
      return sortBy === "newest" ? bDate - aDate : aDate - bDate;
    });
    return list;
  }, [resources, filterCategory, filterType, filterSpeaker, filterDate, search, sortBy]);

  const activeFilterCount =
    (filterCategory !== "All" ? 1 : 0) +
    (filterType !== "all" ? 1 : 0) +
    (filterSpeaker !== "all" ? 1 : 0) +
    (filterDate !== "any" ? 1 : 0) +
    (search.trim() ? 1 : 0);

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
              <h3 className="font-heading text-base font-semibold text-foreground">
                {editingId ? "Edit Resource" : "Add Resource"}
              </h3>
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

            {/* Category */}
            <div>
              <label className="text-sm font-medium text-foreground">Category *</label>
              <Popover open={catOpen} onOpenChange={setCatOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={catOpen}
                    className="mt-1 w-full justify-between font-normal"
                  >
                    {category || "Select category..."}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      placeholder="Search or create category..."
                      value={catSearch}
                      onValueChange={setCatSearch}
                    />
                    <CommandList>
                      <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                        No categories found.
                      </CommandEmpty>
                      <CommandGroup>
                        {filteredCategoryOptions.map((cat) => (
                          <CommandItem
                            key={cat}
                            value={cat}
                            onSelect={() => {
                              setCategory(cat);
                              setCatSearch("");
                              setCatOpen(false);
                            }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", category === cat ? "opacity-100" : "opacity-0")} />
                            {cat}
                          </CommandItem>
                        ))}
                        {isNewCategory && (
                          <CommandItem
                            value={`create-${catSearch}`}
                            onSelect={() => {
                              setCategory(catSearch.trim());
                              setCatSearch("");
                              setCatOpen(false);
                            }}
                          >
                            <Plus className="mr-2 h-4 w-4 text-primary" />
                            Create &ldquo;{catSearch.trim()}&rdquo;
                          </CommandItem>
                        )}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Don&apos;t see the right category? Type any name (e.g. <em>Other</em>) above to create a new one.
              </p>
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

            {/* --- Linking section (all optional) --- */}
            <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Link to a gathering (optional)
              </p>

              {/* Linked Event */}
              <div>
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-primary" />
                  Linked Event
                </label>
                <Popover open={eventPickerOpen} onOpenChange={setEventPickerOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      className="mt-1 w-full justify-between font-normal h-9"
                    >
                      <span className="truncate">
                        {linkedEventId
                          ? eventById.get(linkedEventId)?.title ?? "Loading…"
                          : "Not linked to an event"}
                      </span>
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                    <Command shouldFilter={false}>
                      <CommandInput
                        placeholder="Search events…"
                        value={eventSearch}
                        onValueChange={setEventSearch}
                      />
                      <CommandList>
                        <CommandEmpty className="py-2 px-3 text-sm text-muted-foreground">
                          No events match.
                        </CommandEmpty>
                        <CommandGroup>
                          <CommandItem
                            value="__none__"
                            onSelect={() => { setLinkedEventId(null); setEventPickerOpen(false); }}
                          >
                            <Check className={cn("mr-2 h-4 w-4", !linkedEventId ? "opacity-100" : "opacity-0")} />
                            <span className="text-muted-foreground italic">Not linked</span>
                          </CommandItem>
                          {filteredEvents.map((e) => (
                            <CommandItem
                              key={e.id}
                              value={e.title}
                              onSelect={() => { setLinkedEventId(e.id); setEventPickerOpen(false); }}
                            >
                              <Check className={cn("mr-2 h-4 w-4", linkedEventId === e.id ? "opacity-100" : "opacity-0")} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm">{e.title}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {format(new Date(e.date_time), "MMM d, yyyy")}
                                </p>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Speakers */}
              <SpeakerSelector selectedIds={speakerIds} onChange={setSpeakerIds} />

              {/* Tags */}
              <div>
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Tags
                </label>
                <div className="mt-1">
                  <TagInput
                    value={tags}
                    onChange={setTags}
                    suggestions={allTagSuggestions}
                    placeholder="e.g. Ramadan, Tafsir — press Enter"
                  />
                </div>
              </div>

              {/* Session date */}
              <div>
                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  Session date
                </label>
                <Input
                  type="date"
                  value={resourceDate}
                  onChange={(e) => setResourceDate(e.target.value)}
                  className="mt-1 h-9"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Used for sorting and date filters. Leaves blank to use the upload date.
                </p>
              </div>
            </div>

            {/* Source Toggle — hidden in edit mode */}
            {!editingId && (
              <>
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
                        accept=".pdf,.doc,.docx,.txt"
                        className="hidden"
                        onChange={(e) => {
                          const picked = e.target.files?.[0] ?? null;
                          if (picked) {
                            if (picked.type.startsWith("video/") || picked.type.startsWith("audio/")) {
                              toast.error("Audio and Video files cannot be uploaded directly. Please use the \"External Link\" option instead.");
                              e.target.value = "";
                              return;
                            }
                            if (picked.size > 10 * 1024 * 1024) {
                              toast.error("File is too large. Maximum size is 10MB.");
                              e.target.value = "";
                              return;
                            }
                          }
                          setFile(picked);
                        }}
                      />
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      Limit 10MB. PDFs and Documents only. For audio/video, use the External Link option.
                    </p>
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
              </>
            )}

            <Button
              className="w-full h-11"
              onClick={() => {
                if (editingId) {
                  editMutation.mutate({
                    id: editingId,
                    updates: {
                      title,
                      description: description || null,
                      category: category.trim(),
                      resource_type: resourceType,
                      event_id: linkedEventId,
                      speaker_ids: speakerIds,
                      tags,
                      resource_date: resourceDate || null,
                    } as any,
                  });
                } else {
                  uploadMutation.mutate();
                }
              }}
              disabled={(editingId ? editMutation.isPending : uploadMutation.isPending) || (editingId ? !title.trim() : !isFormValid)}
            >
              {(editingId ? editMutation.isPending : uploadMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? "Save Changes" : source === "upload" ? "Upload Resource" : "Add External Resource"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* --- Filter bar --- */}
      {!isLoading && (resources?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title, description, tags…"
              className="pl-9"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All categories</SelectItem>
                {allCategories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {RESOURCE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterSpeaker} onValueChange={setFilterSpeaker}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Speaker" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any speaker</SelectItem>
                {speakers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterDate} onValueChange={(v) => setFilterDate(v as DatePreset)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Date" /></SelectTrigger>
              <SelectContent>
                {DATE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest first</SelectItem>
                <SelectItem value="oldest">Oldest first</SelectItem>
                <SelectItem value="title">Title A→Z</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>{visibleResources.length} of {resources?.length ?? 0} shown</span>
              <button
                type="button"
                onClick={() => {
                  setFilterCategory("All");
                  setFilterType("all");
                  setFilterSpeaker("all");
                  setFilterDate("any");
                  setSearch("");
                }}
                className="text-primary underline-offset-2 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : !resources?.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">No resources uploaded yet.</p>
      ) : !visibleResources.length ? (
        <p className="text-center text-sm text-muted-foreground py-8">No resources match the current filters.</p>
      ) : (
        <div className="space-y-3">
          {visibleResources.map((res) => {
            const Icon = getResourceIcon(res.resource_type || "pdf");
            const linkedEvent = res.event_id ? eventById.get(res.event_id) : null;
            const linkedSpeakers = (res.speaker_ids ?? [])
              .map((id) => speakerById.get(id)?.name)
              .filter(Boolean) as string[];
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
                    <div className="flex flex-wrap items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                        <Tag className="h-2.5 w-2.5" />
                        {res.category || "General"}
                      </Badge>
                      {res.file_url.startsWith("http") && !res.file_url.includes("supabase") && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <LinkIcon className="h-2.5 w-2.5" />
                          External
                        </Badge>
                      )}
                      {linkedEvent && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/30 text-primary">
                          <CalendarDays className="h-2.5 w-2.5" />
                          {linkedEvent.title}
                        </Badge>
                      )}
                      {linkedSpeakers.slice(0, 2).map((n) => (
                        <Badge key={n} variant="outline" className="text-[10px] px-1.5 py-0 gap-1">
                          <Mic className="h-2.5 w-2.5" />
                          {n}
                        </Badge>
                      ))}
                      {linkedSpeakers.length > 2 && (
                        <span className="text-[10px]">+{linkedSpeakers.length - 2}</span>
                      )}
                      {res.file_size && <span>{formatFileSize(res.file_size)}</span>}
                      <span>·</span>
                      <span>{format(new Date(res.resource_date ?? res.created_at), "MMM d, yyyy")}</span>
                    </div>
                    {(res.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(res.tags ?? []).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => openShare(res.id, res.title, res.short_code)}
                      aria-label="Share resource"
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8"
                      onClick={() => startEdit(res)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => deleteMutation.mutate({ id: res.id, file_url: res.file_url })}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {shareDialog}
    </div>
  );
}
