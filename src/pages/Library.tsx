import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/runtime-client";
// (Card primitives removed — using custom resource cards)
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Loader2, FileText, Download, BookOpen, Search, Video, Headphones,
  Link as LinkIcon, ExternalLink, CalendarDays, Mic, X, SlidersHorizontal, Share2,
  PlayCircle, ListMusic, ChevronLeft, ChevronRight,
} from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";
import EventCard from "@/components/EventCard";
import ResourceCardSkeleton from "@/components/library/ResourceCardSkeleton";
import FeaturedCarousel from "@/components/library/FeaturedCarousel";
import RecentlyAddedSection from "@/components/library/RecentlyAddedSection";
import { ResourceCover } from "@/components/library/resourceCover";
import type { Database } from "@/integrations/supabase/types";
import { EVENT_PUBLIC_COLUMNS } from "@/lib/event-columns";
import { useShareResource } from "@/components/ShareResourceDialog";

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
  event_id?: string | null;
  speaker_ids?: string[] | null;
  tags?: string[] | null;
  resource_date?: string | null;
  short_code?: string | null;
  cover_image_url?: string | null;
}

interface SpeakerLite { id: string; name: string; image_url?: string | null }
interface EventLite { id: string; title: string; date_time: string; cover_photo_url?: string | null }

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const isStoragePath = (url: string) => !url.startsWith("http");
const isExternalUrl = (url: string) => url.startsWith("http") && !url.includes("supabase");

function isPodcastResource(r: { resource_type?: string; category?: string; tags?: string[] | null }) {
  if (r.resource_type === "podcast") return true;
  const cat = (r.category || "").toLowerCase();
  if (cat.includes("podcast")) return true;
  return (r.tags ?? []).some((t) => t.toLowerCase().includes("podcast"));
}
function isAwradResource(r: { category?: string; tags?: string[] | null }) {
  const cat = (r.category || "").toLowerCase();
  if (cat.includes("awrad") || cat.includes("litan") || cat.includes("wird") || cat.includes("dhikr")) return true;
  return (r.tags ?? []).some((t) => /awrad|litan|wird|dhikr/i.test(t));
}
function isPlaylistResource(r: { resource_type?: string; category?: string }) {
  if (r.resource_type === "playlist") return true;
  return (r.category || "").toLowerCase().includes("playlist");
}
function getResourceMeta(res: { resource_type?: string; category?: string; tags?: string[] | null }) {
  if (isPodcastResource(res)) return { Icon: Mic, label: "Podcast" };
  if (isAwradResource(res)) return { Icon: BookOpen, label: "Awrad" };
  if (isPlaylistResource(res)) return { Icon: ListMusic, label: "Playlist" };
  switch (res.resource_type) {
    case "video": return { Icon: PlayCircle, label: "Video" };
    case "audio": return { Icon: Headphones, label: "Audio" };
    case "link": return { Icon: LinkIcon, label: "Link" };
    default: return { Icon: FileText, label: "PDF" };
  }
}

const CATEGORY_PALETTE: { bar: string; tint: string; icon: string; badge: string }[] = [
  { bar: "bg-primary",          tint: "bg-primary/10",          icon: "text-primary",                  badge: "bg-primary/10 text-primary border-primary/20" },
  { bar: "bg-gold",             tint: "bg-gold/15",             icon: "text-gold-foreground",          badge: "bg-gold/15 text-gold-foreground border-gold/30" },
  { bar: "bg-olive",            tint: "bg-olive/15",            icon: "text-olive",                    badge: "bg-olive/15 text-olive border-olive/30" },
  { bar: "bg-clay",             tint: "bg-clay/15",             icon: "text-clay",                     badge: "bg-clay/15 text-clay border-clay/30" },
  { bar: "bg-parchment-deep",   tint: "bg-parchment-deep/30",   icon: "text-foreground/70",            badge: "bg-parchment-deep/30 text-foreground border-parchment-deep/50" },
];

function getCategoryColor(category: string) {
  const cat = (category || "General").trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < cat.length; i++) hash = (hash * 31 + cat.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
}

// In-memory cache so we don't re-sign covers across renders.
const coverUrlCache = new Map<string, { url: string; expires: number }>();

function useCoverSignedUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(() => {
    if (!path) return null;
    const hit = coverUrlCache.get(path);
    return hit && hit.expires > Date.now() ? hit.url : null;
  });
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    const hit = coverUrlCache.get(path);
    if (hit && hit.expires > Date.now()) { setUrl(hit.url); return; }
    let cancelled = false;
    supabase.storage.from("resource-covers").createSignedUrl(path, 3600).then(({ data }) => {
      if (cancelled || !data?.signedUrl) return;
      coverUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 55 * 60 * 1000 });
      setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);
  return url;
}

/** Themed fallback tile — parchment with concentric gold rings + type icon. */
function CoverFallback({ Icon, className = "" }: { Icon: typeof FileText; className?: string }) {
  return (
    <div className={`relative w-full h-full bg-[hsl(var(--parchment-deep))]/40 flex items-center justify-center overflow-hidden ${className}`}>
      <div className="absolute inset-0 flex items-center justify-center opacity-60" aria-hidden>
        <div className="w-[140%] h-[140%] border border-gold/30 rounded-full" />
      </div>
      <div className="absolute inset-0 flex items-center justify-center opacity-40" aria-hidden>
        <div className="w-[90%] h-[90%] border border-gold/40 rounded-full" />
      </div>
      <Icon className="relative h-7 w-7 text-primary/70" />
    </div>
  );
}

/** Renders the best available cover image for a resource, with fallbacks. */
function ResourceCover({
  res, speakerImage, eventCover, Icon, rounded = "rounded-2xl",
}: {
  res: { cover_image_url?: string | null };
  speakerImage?: string | null;
  eventCover?: string | null;
  Icon: typeof FileText;
  rounded?: string;
}) {
  const signed = useCoverSignedUrl(res.cover_image_url ?? null);
  const src = signed || speakerImage || eventCover || null;
  return (
    <div className={`w-full h-full overflow-hidden ${rounded}`}>
      {src ? (
        <img src={src} alt="" className="w-full h-full object-cover" loading="lazy" />
      ) : (
        <CoverFallback Icon={Icon} />
      )}
    </div>
  );
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
  if (preset === "any") return true;
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  if (preset === "month") return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  if (preset === "3months") {
    const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - 3);
    return d >= cutoff;
  }
  if (preset === "year") return d.getFullYear() === now.getFullYear();
  if (preset === "older") return d.getFullYear() < now.getFullYear();
  return true;
}

function getEventMode(ev: Event): "online" | "hybrid" | "in-person" {
  const hasOnline = !!(ev.online_link || (ev as any).virtual_link || (ev as any).zoom_link);
  if ((ev as any).is_hybrid && hasOnline) return "hybrid";
  if (hasOnline && !ev.location) return "online";
  if (hasOnline) return "hybrid";
  return "in-person";
}

export default function Library() {
  const { resourceId: deepLinkId } = useParams<{ resourceId?: string }>();
  const navigate = useNavigate();
  const { open: openShare, dialog: shareDialog } = useShareResource();
  const [selected, setSelected] = useState<Resource | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterSpeaker, setFilterSpeaker] = useState<string>("all");
  const [filterDate, setFilterDate] = useState<DatePreset>("any");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "title">("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [tab, setTab] = useState<"resources" | "past">("resources");
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const pillsRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Recordings tab filters
  const [recSearch, setRecSearch] = useState("");
  const [recMode, setRecMode] = useState<"all" | "in-person" | "online" | "hybrid">("all");
  const [recSpeaker, setRecSpeaker] = useState<string>("all");
  const [recDate, setRecDate] = useState<DatePreset>("any");
  const [recSort, setRecSort] = useState<"newest" | "oldest">("newest");

  const { data: resources, isLoading } = useQuery({
    queryKey: ["resources"],
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resources")
        .select("id, title, description, file_url, file_name, file_size, created_at, category, resource_type, event_id, speaker_ids, tags, resource_date, short_code, cover_image_url")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as Resource[]).map((r) => ({
        ...r,
        signed_url: isStoragePath(r.file_url) ? undefined : r.file_url,
      }));
    },
  });

  const { data: speakers = [] } = useQuery({
    queryKey: ["speakers"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("speakers")
        .select("id, name, image_url")
        .order("name");
      if (error) throw error;
      return (data as any[]) as SpeakerLite[];
    },
  });

  const { data: linkedEvents = [] } = useQuery({
    queryKey: ["resource-linked-events"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, title, date_time, cover_photo_url")
        .order("date_time", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) as EventLite[];
    },
  });

  const speakerById = useMemo(() => {
    const m = new Map<string, SpeakerLite>();
    speakers.forEach((s) => m.set(s.id, s));
    return m;
  }, [speakers]);

  const eventById = useMemo(() => {
    const m = new Map<string, EventLite>();
    linkedEvents.forEach((e) => m.set(e.id, e));
    return m;
  }, [linkedEvents]);

  const categories = useMemo(() => {
    if (!resources) return [];
    return Array.from(new Set(resources.map((r) => r.category || "General"))).sort();
  }, [resources]);

  // Speakers actually referenced by some resource
  const speakersWithResources = useMemo(() => {
    const set = new Set<string>();
    resources?.forEach((r) => (r.speaker_ids ?? []).forEach((id) => set.add(id)));
    return speakers.filter((s) => set.has(s.id));
  }, [resources, speakers]);

  const debouncedSearch = useDebounce(search, 300);

  const filtered = useMemo(() => {
    if (!resources) return [];
    let list = resources;
    if (activeCategory !== "All") list = list.filter((r) => (r.category || "General") === activeCategory);
    if (filterType !== "all") list = list.filter((r) => (r.resource_type || "pdf") === filterType);
    if (filterSpeaker !== "all") list = list.filter((r) => (r.speaker_ids ?? []).includes(filterSpeaker));
    if (filterDate !== "any") list = list.filter((r) => inDatePreset(r.resource_date ?? r.created_at, filterDate));
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase();
      list = list.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          (r.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    list = [...list].sort((a, b) => {
      if (sortBy === "title") return a.title.localeCompare(b.title);
      const aD = new Date(a.resource_date ?? a.created_at).getTime();
      const bD = new Date(b.resource_date ?? b.created_at).getTime();
      return sortBy === "newest" ? bD - aD : aD - bD;
    });
    return list;
  }, [resources, debouncedSearch, activeCategory, filterType, filterSpeaker, filterDate, sortBy]);

  useEffect(() => {
    if (!pillsRef.current) return;
    const active = pillsRef.current.querySelector('[data-active="true"]');
    if (active) active.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategory]);

  const handleResourceClick = async (res: Resource) => {
    if (isExternalUrl(res.file_url)) {
      window.open(res.file_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (isStoragePath(res.file_url)) {
      const { data: signedData, error } = await supabase.storage
        .from("resources")
        .createSignedUrl(res.file_url, 3600);
      if (error || !signedData?.signedUrl) {
        const { data: dlData } = await supabase.storage
          .from("resources")
          .createSignedUrl(res.file_url, 3600, { download: true });
        if (dlData?.signedUrl) {
          window.open(dlData.signedUrl, "_blank", "noopener,noreferrer");
        } else {
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

  // Handle deep links: /library/:resourceId — open viewer, highlight & scroll
  const deepHandled = useRef<string | null>(null);
  useEffect(() => {
    if (!deepLinkId || !resources) return;
    if (deepHandled.current === deepLinkId) return;
    const res = resources.find((r) => r.id === deepLinkId);
    if (!res) return;
    deepHandled.current = deepLinkId;
    setTab("resources");
    // Clear any restrictive filters so the card is visible
    setActiveCategory("All");
    setFilterType("all");
    setFilterSpeaker("all");
    setFilterDate("any");
    setSearch("");
    setHighlightId(res.id);
    handleResourceClick(res);
    // Scroll into view after layout
    setTimeout(() => {
      const el = cardRefs.current.get(res.id);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
    // Remove highlight after a moment
    setTimeout(() => setHighlightId(null), 2500);
    // Clean URL so refresh doesn't reopen
    navigate("/library", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deepLinkId, resources]);


  // Past events with recordings
  const { data: pastEvents, isLoading: pastLoading } = useQuery({
    queryKey: ["past-events-with-recordings"],
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
        .not("recording_url", "is", null)
        .neq("recording_url", "")
        .or(`and(end_date_time.not.is.null,end_date_time.lt.${now}),and(end_date_time.is.null,date_time.lt.${fallbackCutoff})`)
        .order("date_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as Event[];
    },
  });

  // Speaker map for recordings tab — fetch event_speakers for the loaded past events
  const pastEventIds = useMemo(() => (pastEvents ?? []).map((e) => e.id), [pastEvents]);
  const { data: pastEventSpeakerLinks = [] } = useQuery({
    queryKey: ["past-event-speakers", pastEventIds.join(",")],
    enabled: pastEventIds.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_speakers")
        .select("event_id, speaker_id")
        .in("event_id", pastEventIds);
      if (error) throw error;
      return data as { event_id: string; speaker_id: string }[];
    },
  });

  const speakerIdsByEvent = useMemo(() => {
    const m = new Map<string, Set<string>>();
    pastEventSpeakerLinks.forEach((row) => {
      if (!m.has(row.event_id)) m.set(row.event_id, new Set());
      m.get(row.event_id)!.add(row.speaker_id);
    });
    return m;
  }, [pastEventSpeakerLinks]);

  const speakersForRecordings = useMemo(() => {
    const ids = new Set<string>();
    pastEventSpeakerLinks.forEach((r) => ids.add(r.speaker_id));
    return speakers.filter((s) => ids.has(s.id));
  }, [pastEventSpeakerLinks, speakers]);

  const filteredPastEvents = useMemo(() => {
    if (!pastEvents) return [];
    let list = pastEvents;
    if (recMode !== "all") list = list.filter((e) => getEventMode(e) === recMode);
    if (recSpeaker !== "all") list = list.filter((e) => speakerIdsByEvent.get(e.id)?.has(recSpeaker));
    if (recDate !== "any") list = list.filter((e) => inDatePreset(e.date_time, recDate));
    if (recSearch.trim()) {
      const q = recSearch.toLowerCase();
      list = list.filter((e) => e.title.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const aD = new Date(a.date_time).getTime();
      const bD = new Date(b.date_time).getTime();
      return recSort === "newest" ? bD - aD : aD - bD;
    });
    return list;
  }, [pastEvents, recMode, recSpeaker, recDate, recSearch, recSort, speakerIdsByEvent]);

  // Active filter chips for Resources tab
  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (activeCategory !== "All") activeChips.push({ key: "cat", label: activeCategory, clear: () => setActiveCategory("All") });
  if (filterType !== "all") activeChips.push({ key: "type", label: filterType.toUpperCase(), clear: () => setFilterType("all") });
  if (filterSpeaker !== "all") activeChips.push({ key: "sp", label: speakerById.get(filterSpeaker)?.name ?? "Speaker", clear: () => setFilterSpeaker("all") });
  if (filterDate !== "any") activeChips.push({ key: "date", label: DATE_PRESETS.find((d) => d.value === filterDate)!.label, clear: () => setFilterDate("any") });

  const clearAllFilters = () => {
    setActiveCategory("All");
    setFilterType("all");
    setFilterSpeaker("all");
    setFilterDate("any");
    setSearch("");
  };

  const hasActiveResourceFilters =
    activeCategory !== "All" ||
    filterType !== "all" ||
    filterSpeaker !== "all" ||
    filterDate !== "any" ||
    debouncedSearch.trim().length > 0;

  // Recently added (top 6 by date) — only when no filters
  const recentResources = useMemo(() => {
    if (!resources) return [] as Resource[];
    return [...resources]
      .sort(
        (a, b) =>
          new Date(b.resource_date ?? b.created_at).getTime() -
          new Date(a.resource_date ?? a.created_at).getTime()
      )
      .slice(0, 6);
  }, [resources]);

  // Group filtered resources by category
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, Resource[]>();
    filtered.forEach((r) => {
      const c = r.category || "General";
      if (!map.has(c)) map.set(c, []);
      map.get(c)!.push(r);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <header className="border-b border-border bg-card px-4 pb-4 pt-6">
        <div className="flex items-center gap-2">
          <BookOpen className="h-6 w-6 text-primary" />
          <h1 className="font-heading text-2xl font-bold text-foreground">Library</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">Resources & past gatherings</p>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "resources" | "past")} className="w-full">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="resources" className="flex-1">Resources</TabsTrigger>
            <TabsTrigger value="past" className="flex-1">Recordings</TabsTrigger>
          </TabsList>

          <TabsContent value="resources">
            {!isLoading && categories.length > 0 && (
              <div
                ref={pillsRef}
                className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1"
              >
                {["All", ...categories].map((cat) => {
                  const isActive = activeCategory === cat;
                  const color = cat === "All" ? null : getCategoryColor(cat);
                  const activeClass = cat === "All"
                    ? "bg-primary text-primary-foreground"
                    : `${color!.bar} text-white`;
                  const inactiveClass = cat === "All"
                    ? "bg-muted text-muted-foreground hover:bg-muted/80"
                    : `${color!.tint} ${color!.icon} hover:opacity-80`;
                  return (
                    <button
                      key={cat}
                      data-active={isActive}
                      onClick={() => setActiveCategory(cat)}
                      className={`flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                        isActive ? activeClass : inactiveClass
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            )}

            {!isLoading && resources && resources.length > 0 && (
              <>
                <div className="flex gap-2 mb-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search title, description, tags…"
                      className="pl-9"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-label="Toggle filters"
                    className={filtersOpen ? "bg-muted" : ""}
                  >
                    <SlidersHorizontal className="h-4 w-4" />
                  </Button>
                </div>

                {filtersOpen && (
                  <div className="grid grid-cols-2 gap-2 mb-2 rounded-lg border border-border bg-muted/30 p-2">
                    <Select value={filterType} onValueChange={setFilterType}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        <SelectItem value="pdf">PDF</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                        <SelectItem value="audio">Audio</SelectItem>
                        <SelectItem value="link">Link</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={filterSpeaker} onValueChange={setFilterSpeaker}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Speaker" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any speaker</SelectItem>
                        {speakersWithResources.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
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
                )}

                {activeChips.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mb-3">
                    {activeChips.map((c) => (
                      <Badge key={c.key} variant="secondary" className="gap-1 pr-1">
                        {c.label}
                        <button onClick={c.clear} className="ml-0.5 rounded-full hover:bg-muted p-0.5" aria-label="Remove filter">
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                    <button onClick={clearAllFilters} className="text-xs text-primary underline-offset-2 hover:underline ml-1">
                      Clear all
                    </button>
                  </div>
                )}
              </>
            )}

            {isLoading ? (
              <div className="grid gap-3">
                {Array.from({ length: 5 }).map((_, i) => <ResourceCardSkeleton key={i} />)}
              </div>
            ) : !resources?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No resources available yet.</p>
                <p className="text-xs text-muted-foreground mt-1">Check back later for community materials.</p>
              </div>
            ) : !filtered.length ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-10 w-10 text-muted-foreground/50 mb-2" />
                <p className="text-muted-foreground">No resources match your filters.</p>
                <Button variant="link" size="sm" onClick={clearAllFilters} className="mt-1">
                  Clear filters
                </Button>
              </div>
            ) : (
              (() => {
                const renderListCard = (res: Resource) => {
                  const { Icon, label } = getResourceMeta(res);
                  const isExternal = isExternalUrl(res.file_url);
                  const color = getCategoryColor(res.category || "General");
                  const linkedEvent = res.event_id ? eventById.get(res.event_id) : null;
                  const podcast = isPodcastResource(res);
                  const firstSpeaker = podcast
                    ? (res.speaker_ids ?? []).map((id) => speakerById.get(id)).find(Boolean)
                    : undefined;
                  const linkedSpeakers = (res.speaker_ids ?? [])
                    .map((id) => speakerById.get(id)?.name)
                    .filter(Boolean) as string[];
                  return (
                    <div
                      key={res.id}
                      ref={(el) => {
                        if (el) cardRefs.current.set(res.id, el);
                        else cardRefs.current.delete(res.id);
                      }}
                      onClick={() => handleResourceClick(res)}
                      className={`group cursor-pointer bg-white/60 border border-gold/15 rounded-2xl p-3 flex gap-3 transition-all hover:bg-card hover:shadow-lg hover:shadow-primary/5 active:scale-[0.99] ${
                        highlightId === res.id ? "ring-2 ring-primary shadow-lg" : ""
                      }`}
                    >
                      {podcast && firstSpeaker?.image_url ? (
                        <div className="relative flex-shrink-0">
                          <Avatar className="w-14 h-14 border border-gold/30">
                            <AvatarImage src={firstSpeaker.image_url} alt={firstSpeaker.name} className="object-cover" />
                            <AvatarFallback>{firstSpeaker.name.charAt(0)}</AvatarFallback>
                          </Avatar>
                          <div className="absolute -bottom-0.5 -right-0.5 bg-gold text-gold-foreground p-1 rounded-full ring-2 ring-card">
                            <Mic className="h-2.5 w-2.5" strokeWidth={3} />
                          </div>
                        </div>
                      ) : (res.cover_image_url || linkedEvent?.cover_photo_url) ? (
                        <div className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 border border-gold/20">
                          <ResourceCover
                            res={res}
                            eventCover={linkedEvent?.cover_photo_url ?? null}
                            Icon={Icon}
                            rounded=""
                          />
                        </div>
                      ) : (
                        <div className={`w-14 h-14 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${color.tint} ${color.icon} group-hover:bg-primary group-hover:text-primary-foreground`}>
                          <Icon className="h-6 w-6" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="font-heading text-base font-semibold text-foreground leading-snug flex items-center gap-1.5 min-w-0">
                            <span className="truncate">{res.title}</span>
                            {isExternal && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />}
                          </h4>
                          <span className="text-[10px] text-muted-foreground font-medium flex-shrink-0 uppercase tracking-wider">
                            {label.toUpperCase()}
                          </span>
                        </div>
                        {res.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{res.description}</p>
                        )}
                        {linkedSpeakers.length > 0 && !podcast && (
                          <p className="mt-1 text-xs text-foreground/80 flex items-center gap-1">
                            <Mic className="h-3 w-3 text-primary" />
                            <span className="truncate">{linkedSpeakers.join(", ")}</span>
                          </p>
                        )}
                        {podcast && firstSpeaker && (
                          <p className="mt-1 text-xs text-foreground/80 truncate">{firstSpeaker.name}</p>
                        )}
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-tight text-gold-foreground/80 min-w-0">
                            {res.file_size && <span className="truncate">{formatFileSize(res.file_size)}</span>}
                            {res.file_size && <span className="text-muted-foreground">·</span>}
                            <span className="truncate text-muted-foreground font-medium normal-case tracking-normal">
                              {format(new Date(res.resource_date ?? res.created_at), "MMM d, yyyy")}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="text-primary/40 hover:text-primary p-1.5 -mr-1 rounded-md"
                            aria-label="Share resource"
                            onClick={(e) => {
                              e.stopPropagation();
                              openShare(res.id, res.title, res.short_code);
                            }}
                          >
                            <Share2 className="h-4 w-4" />
                          </button>
                        </div>
                        {linkedEvent && (
                          <Link
                            to={`/event/${linkedEvent.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1.5 inline-flex"
                          >
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 border-primary/40 text-primary hover:bg-primary/10">
                              <CalendarDays className="h-2.5 w-2.5" />
                              From: {linkedEvent.title}
                            </Badge>
                          </Link>
                        )}
                        {(res.tags ?? []).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(res.tags ?? []).slice(0, 4).map((t) => (
                              <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                #{t}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                };

                const renderFeaturedCard = (res: Resource) => {
                  const { Icon, label } = getResourceMeta(res);
                  const linkedEvent = res.event_id ? eventById.get(res.event_id) : null;
                  const firstSpeaker = (res.speaker_ids ?? [])
                    .map((id) => speakerById.get(id))
                    .find(Boolean);
                  return (
                    <button
                      key={res.id}
                      type="button"
                      onClick={() => handleResourceClick(res)}
                      className="flex-none w-24 sm:w-28 md:w-32 lg:w-36 snap-start text-left group"
                    >
                      <div className="relative aspect-square rounded-2xl overflow-hidden shadow-sm border border-gold/15 bg-card transition-transform group-active:scale-[0.98]">
                        <ResourceCover
                          res={res}
                          speakerImage={firstSpeaker?.image_url ?? null}
                          eventCover={linkedEvent?.cover_photo_url ?? null}
                          Icon={Icon}
                          rounded=""
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" aria-hidden />
                        <div className="absolute top-2 left-2 flex items-center gap-1 bg-card/90 backdrop-blur-sm pl-1.5 pr-2 py-0.5 rounded-full border border-gold/20">
                          <Icon className="h-2.5 w-2.5 text-primary" />
                          <span className="text-[9px] font-semibold text-foreground uppercase tracking-wide">
                            {label}
                          </span>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-2.5">
                          <h3 className="font-heading text-sm font-semibold text-white leading-tight line-clamp-2 drop-shadow">
                            {res.title}
                          </h3>
                        </div>
                      </div>
                    </button>
                  );
                };

                if (hasActiveResourceFilters) {
                  return (
                    <div className="grid gap-3">
                      {filtered.map(renderListCard)}
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {recentResources.length > 0 && (
                      <section>
                        <div className="flex items-end justify-between mb-3">
                          <div>
                            <h2 className="font-heading text-lg font-semibold text-foreground">
                              Recently Added
                            </h2>
                            <div className="mt-1 flex items-center gap-1 text-gold/70" aria-hidden>
                              <span className="text-[8px]">◆</span>
                              <span className="text-[6px]">◆</span>
                              <span className="text-[8px]">◆</span>
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {recentResources.length} new
                          </span>
                        </div>
                        <FeaturedCarousel>
                          {recentResources.map(renderFeaturedCard)}
                        </FeaturedCarousel>
                      </section>
                    )}
                    {groupedByCategory.map(([cat, items]) => (
                      <section key={cat}>
                        <div className="flex items-end justify-between mb-3">
                          <div>
                            <h2 className="font-heading text-lg font-semibold text-foreground">
                              {cat}
                            </h2>
                            <div className="mt-1 flex items-center gap-1 text-gold/70" aria-hidden>
                              <span className="text-[8px]">◆</span>
                              <span className="text-[6px]">◆</span>
                              <span className="text-[8px]">◆</span>
                            </div>
                          </div>
                          {items.length > 4 && (
                            <button
                              onClick={() => setActiveCategory(cat)}
                              className="text-xs font-medium text-primary hover:underline"
                            >
                              See all ({items.length})
                            </button>
                          )}
                        </div>
                        <div className="space-y-3">
                          {items.slice(0, 4).map(renderListCard)}
                        </div>
                      </section>
                    ))}
                  </div>
                );
              })()
            )}
          </TabsContent>

          <TabsContent value="past">
            {pastLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : !pastEvents?.length ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Video className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-muted-foreground">No recordings available yet.</p>
              </div>
            ) : (
              <>
                {/* Recordings filter row */}
                <div className="space-y-2 mb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={recSearch}
                      onChange={(e) => setRecSearch(e.target.value)}
                      placeholder="Search recordings…"
                      className="pl-9"
                    />
                  </div>
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
                    {(["all", "in-person", "online", "hybrid"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setRecMode(m)}
                        className={`flex-shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                          recMode === m
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {m === "all" ? "All" : m === "in-person" ? "In-person" : m === "online" ? "Online" : "Hybrid"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Select value={recSpeaker} onValueChange={setRecSpeaker}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Speaker" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any speaker</SelectItem>
                        {speakersForRecordings.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={recDate} onValueChange={(v) => setRecDate(v as DatePreset)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Date" /></SelectTrigger>
                      <SelectContent>
                        {DATE_PRESETS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Select value={recSort} onValueChange={(v) => setRecSort(v as typeof recSort)}>
                      <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Sort" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="newest">Newest first</SelectItem>
                        <SelectItem value="oldest">Oldest first</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {filteredPastEvents.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <Search className="h-10 w-10 text-muted-foreground/50 mb-2" />
                    <p className="text-muted-foreground">No recordings match these filters.</p>
                    <Button
                      variant="link"
                      size="sm"
                      onClick={() => {
                        setRecSearch(""); setRecMode("all"); setRecSpeaker("all"); setRecDate("any");
                      }}
                      className="mt-1"
                    >
                      Clear filters
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredPastEvents.map((event) => (
                      <EventCard key={event.id} event={event} isPast />
                    ))}
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* PDF Viewer Modal — only for storage files */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent
          className="max-w-4xl w-screen sm:w-[95vw] h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-lg flex flex-col p-0 gap-0 [&>button.absolute]:hidden"
          style={{ paddingTop: "env(safe-area-inset-top)", paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <DialogHeader className="flex flex-row items-center justify-between gap-2 px-3 py-2 border-b border-border flex-shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-10 w-10 flex-shrink-0"
              onClick={() => setSelected(null)}
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </Button>
            <DialogTitle className="font-heading text-base sm:text-lg truncate flex-1 min-w-0 text-left flex items-center gap-2">
              {selected && (() => {
                const { Icon, label } = getResourceMeta(selected);
                return (
                  <span className="inline-flex items-center gap-1.5 text-primary flex-shrink-0" aria-label={label}>
                    <Icon className="h-4 w-4" />
                  </span>
                );
              })()}
              <span className="truncate">{selected?.title}</span>
            </DialogTitle>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button
                size="icon"
                variant="outline"
                className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 sm:gap-1.5"
                onClick={() => selected && openShare(selected.id, selected.title, selected.short_code)}
                aria-label="Share"
              >
                <Share2 className="h-4 w-4" />
                <span className="hidden sm:inline">Share</span>
              </Button>
              <Button size="icon" className="h-10 w-10 sm:h-9 sm:w-auto sm:px-3 sm:gap-1.5" asChild aria-label="Download">
                <a href={selected?.signed_url || "#"} download={selected?.file_name || "document.pdf"} target="_blank" rel="noopener noreferrer">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Download</span>
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

      {shareDialog}
    </div>
  );
}
