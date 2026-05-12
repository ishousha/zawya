import { useState, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, FileText, Download, BookOpen, Search, Tag, Video, Headphones, Link as LinkIcon, ExternalLink, Calendar } from "lucide-react";
import { format } from "date-fns";
import EventCard from "@/components/EventCard";
import ResourceCardSkeleton from "@/components/library/ResourceCardSkeleton";
import type { Database } from "@/integrations/supabase/types";

type Event = Database["public"]["Tables"]["events"]["Row"];

interface Resource {
  id: string;
  title: string;
  description: string | null;
  file_url: string;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  category: string;
  resource_type?: string;
  signed_url?: string;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Check if a file_url is a storage path (not a full URL) */
function isStoragePath(url: string) {
  return !url.startsWith("http");
}

/** Check if URL is an external link (not Supabase storage) */
function isExternalUrl(url: string) {
  return url.startsWith("http") && !url.includes("supabase");
}

function getResourceIcon(type?: string) {
  switch (type) {
    case "video": return Video;
    case "audio": return Headphones;
    case "link": return LinkIcon;
    default: return FileText;
  }
}

export default function Library() {
  const [selected, setSelected] = useState<Resource | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const pillsRef = useRef<HTMLDivElement>(null);

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, title, description, file_url, file_name, file_size, created_at, category, resource_type")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;

      // Don't batch sign URLs here — generate on demand when user opens a resource
      return (data as Resource[]).map((r) => {
        if (isStoragePath(r.file_url)) {
          return { ...r, signed_url: undefined };
        }
        return { ...r, signed_url: r.file_url };
      });
    },
  });

  const categories = useMemo(() => {
    if (!resources) return [];
    const cats = new Set(resources.map((r) => r.category || "General"));
    return Array.from(cats).sort();
  }, [resources]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    if (!resources) return [];
    let list = resources;
    if (activeCategory !== "All") {
      list = list.filter((r) => (r.category || "General") === activeCategory);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [resources, debouncedSearch, activeCategory]);

  useEffect(() => {
    if (!pillsRef.current) return;
    const active = pillsRef.current.querySelector('[data-active="true"]');
    if (active) {
      active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
    }
  }, [activeCategory]);

  const friendlyCategoryName = (cat: string) => {
    const lower = cat.toLowerCase();
    if (lower.includes("book")) return "books";
    if (lower.includes("awrad") || lower.includes("wird")) return "awrad";
    if (lower.includes("event")) return "event materials";
    return cat.toLowerCase() + " resources";
  };

  /** Handle clicking a resource: external links open in new tab, storage files generate signed URL then open */
  const handleResourceClick = async (res: Resource) => {
    if (isExternalUrl(res.file_url)) {
      window.open(res.file_url, "_blank", "noopener,noreferrer");
      return;
    }

    // For storage files, generate a fresh signed URL on click
    if (isStoragePath(res.file_url)) {
      const { data: signedData, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(res.file_url, 3600);

      if (error || !signedData?.signedUrl) {
        // Fallback: try to download directly
        const { data: dlData } = await supabase.storage
          .from("resources")
          .createSignedUrl(res.file_url, 3600, { download: true });
        if (dlData?.signedUrl) {
          window.open(dlData.signedUrl, "_blank", "noopener,noreferrer");
        } else {
          // Last resort: show error
          const { toast } = await import("sonner");
          toast.error("Unable to load this resource. Please try again.");
        }
        return;
      }

      setSelected({ ...res, signed_url: signedData.signedUrl });
    } else {
      setSelected(res);
    }
  };

  // Past events query
  const { data: pastEvents, isLoading: pastLoading } = useQuery({
    queryKey: ["past-events"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const now = new Date().toISOString();
      const fallbackCutoff = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString();

      const { data, error } = await supabase
        .from("events")
        .select(EVENT_PUBLIC_COLUMNS)
        .in("status", ["active", "full", "cancelled"])
        .or(`and(end_date_time.not.is.null,end_date_time.lt.${now}),and(end_date_time.is.null,date_time.lt.${fallbackCutoff})`)
        .order("date_time", { ascending: false })
        .limit(20);

      if (error) throw error;
      return data as Event[];
    },
  });

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Library</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Resources & past gatherings
        </p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Tabs defaultValue="resources" className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="resources" className="flex-1">Resources</TabsTrigger>
            <TabsTrigger value="past" className="flex-1">Past Gatherings</TabsTrigger>
          </TabsList>

          <TabsContent value="resources">
            {!isLoading && categories.length > 0 && (
              <div
                ref={pillsRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1"
              >
                {["All", ...categories].map((cat) => (
                  <button
                    key={cat}
                    data-active={activeCategory === cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                      activeCategory === cat
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {!isLoading && resources && resources.length > 0 && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search resources..."
                  className="pl-9"
                />
              </div>
            )}

            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ResourceCardSkeleton key={i} />
                ))}
              </div>
            ) : !resources?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No resources available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Check back later for community materials.</p>
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                {search.trim() ? (
                  <>
                    <Search className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No results for &ldquo;{search}&rdquo;</p>
                  </>
                ) : (
                  <>
                    <BookOpen className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">
                      No {friendlyCategoryName(activeCategory)} uploaded yet.
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Check back soon!</p>
                  </>
                )}
              </div>
            ) : (
              <div className="grid gap-3">
                {filtered.map((res) => {
                  const Icon = getResourceIcon(res.resource_type);
                  const isExternal = isExternalUrl(res.file_url);
                  return (
                    <Card
                      key={res.id}
                      className="cursor-pointer transition-shadow hover:shadow-md active:scale-[0.99]"
                      onClick={() => handleResourceClick(res)}
                    >
                      <CardContent className="flex items-start gap-3 p-4">
                        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-heading text-base font-semibold text-foreground flex items-center gap-1.5">
                            <span className="truncate">{res.title}</span>
                            {isExternal && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                          </h3>
                          {res.description && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{res.description}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
                              <Tag className="h-2.5 w-2.5" />
                              {res.category || "General"}
                            </Badge>
                            {res.file_size && <span>{formatFileSize(res.file_size)}</span>}
                            <span>·</span>
                            <span>{format(new Date(res.created_at), "MMM d, yyyy")}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !pastEvents?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No past gatherings yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pastEvents.map((event) => (
                  <EventCard key={event.id} event={event} isPast />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* PDF Viewer Modal — only for storage files */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="flex flex-row items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
            <DialogTitle className="font-heading text-lg truncate pr-2">
              {selected?.title}
            </DialogTitle>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button size="sm" className="gap-1.5" asChild>
                <a href={selected?.signed_url || "#"} download={selected?.file_name || "document.pdf"} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  Download
                </a>
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            {selected?.signed_url && (
              <iframe
                src={`${selected.signed_url}#toolbar=1&navpanes=0`}
                className="h-full w-full border-0"
                title={selected.title}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
